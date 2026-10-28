import type { PlanRequestStatus } from "@prisma/client";
import type { z } from "zod";
import { PLAN_LIMITS } from "@/config/plans";
import { requireOwner, type TenantContext } from "@/server/auth/tenant-context";
import { prisma, runInTransaction } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/errors";
import { logActivity } from "@/server/repositories/activity-repository";
import * as billing from "@/server/repositories/billing-repository";
import * as money from "@/server/repositories/money-repository";
import * as requests from "@/server/repositories/plan-request-repository";
import type {
  paymentOptionInput,
  paymentOptionUpdate,
  planRequestDecision,
  planRequestFields,
} from "@/server/validation/schemas";
import { type PlatformActor, requireSuperAdmin } from "./admin-service";
import { recordAction } from "./audit";
import { duplicateAsConflict } from "./constraint-errors";
import { addPlanMonths } from "./billing-service";
import { detectImageType } from "./photo-service";

// Paying Mabeet for a plan by hand (bank transfer, Whish or OMT transfer, crypto, cash): the host sends the
// money to one of the ways the super admin lists, then asks for the plan with a receipt. Nothing changes until a
// super admin approves it; then the plan starts at once for the months paid, and is recorded as plan revenue.

const MAX_RECEIPT_BYTES = 5_000_000;

const isPdf = (bytes: Uint8Array) => String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";

function receiptType(bytes: Uint8Array): string {
  if (bytes.byteLength === 0) throw invalid("The receipt is empty");
  if (bytes.byteLength > MAX_RECEIPT_BYTES) throw invalid("Receipts must be smaller than 5 MB");
  const type = detectImageType(bytes) ?? (isPdf(bytes) ? "application/pdf" : null);
  if (!type) throw invalid("Upload the receipt as a photo or screenshot (JPEG, PNG, WebP) or a PDF");
  return type;
}

// ---------- The ways to pay Mabeet ----------

/** For owners on the billing page: where to send the money. */
export function listPaymentOptions() {
  return requests.listPaymentOptions(prisma, true);
}

export function listAllPaymentOptions(actor: PlatformActor) {
  requireSuperAdmin(actor);
  return requests.listPaymentOptions(prisma, false);
}

export async function addPaymentOption(actor: PlatformActor, input: z.infer<typeof paymentOptionInput>) {
  requireSuperAdmin(actor);
  return requests.createPaymentOption(prisma, input);
}

export async function editPaymentOption(
  actor: PlatformActor,
  id: string,
  input: z.infer<typeof paymentOptionUpdate>,
) {
  requireSuperAdmin(actor);
  if (!(await requests.updatePaymentOption(prisma, id, input))) throw notFound("Payment option");
}

export async function removePaymentOption(actor: PlatformActor, id: string) {
  requireSuperAdmin(actor);
  if (!(await requests.deletePaymentOption(prisma, id))) throw notFound("Payment option");
}

// ---------- Host requests ----------

const OWNER_ONLY = "Only an owner can change the plan";

export async function listMyPlanRequests(ctx: TenantContext) {
  requireOwner(ctx, OWNER_ONLY);
  return requests.listBusinessRequests(prisma, ctx.businessId);
}

/**
 * The owner paid by hand and asks for the plan. The way they paid must be one Mabeet lists, the receipt must
 * be a real image or PDF, and a business on a card subscription changes plan through Stripe instead.
 */
export async function requestPlan(
  ctx: TenantContext,
  input: z.infer<typeof planRequestFields> & { receipt: Uint8Array<ArrayBuffer> },
) {
  requireOwner(ctx, OWNER_ONLY);
  const option = await requests.findPaymentOption(prisma, input.optionId);
  if (!option?.active) throw invalid("Choose one of the ways to pay listed on this page");
  const receiptMime = receiptType(input.receipt);
  const current = await billing.findBilling(prisma, ctx.businessId);
  if (!current) throw notFound("Business");
  if (current.stripeSubscriptionId) throw conflict("You pay by card. Change your plan from Manage billing.");
  const request = await duplicateAsConflict(
    "You already have a request waiting. Cancel it first to send a new one.",
    () =>
      requests.createPlanRequest(prisma, {
        businessId: ctx.businessId,
        requestedById: ctx.userId,
        plan: input.plan,
        months: input.months,
        amountCents: PLAN_LIMITS[input.plan].monthlyUsd * 100 * input.months,
        method: option.method,
        payerReference: input.payerReference ?? null,
        note: input.note ?? null,
        receiptMime,
        receiptBytes: input.receipt,
      }),
  );
  await recordAction(ctx, "plan.requested", "plan_request", request.id);
  return request;
}

export async function cancelPlanRequest(ctx: TenantContext, requestId: string) {
  requireOwner(ctx, OWNER_ONLY);
  const closed = await requests.closeRequest(prisma, requestId, { status: "CANCELLED" }, ctx.businessId);
  if (!closed) throw conflict("This request is no longer waiting.");
  await recordAction(ctx, "plan.request_cancelled", "plan_request", requestId);
}

/** The receipt, for the business's owners or a platform admin only. */
export async function getReceiptForBusiness(ctx: TenantContext, requestId: string) {
  requireOwner(ctx, OWNER_ONLY);
  const receipt = await requests.findReceipt(prisma, requestId);
  if (!receipt || receipt.businessId !== ctx.businessId) throw notFound("Receipt");
  return receipt;
}

// ---------- Platform admin ----------

export function listPlanRequests(actor: PlatformActor, status: PlanRequestStatus | null) {
  requireSuperAdmin(actor);
  return requests.listRequests(prisma, status);
}

export async function getReceiptForAdmin(actor: PlatformActor, requestId: string) {
  requireSuperAdmin(actor);
  const receipt = await requests.findReceipt(prisma, requestId);
  if (!receipt) throw notFound("Receipt");
  return receipt;
}

/**
 * Approving starts the plan for the months paid, at once, and records the payment as Mabeet's revenue; all in
 * one transaction, so a request is never approved without its plan or counted twice. Rejecting changes nothing
 * but the request, with a note the host sees.
 */
export async function decidePlanRequest(
  actor: PlatformActor,
  requestId: string,
  input: z.infer<typeof planRequestDecision>,
  now = new Date(),
) {
  requireSuperAdmin(actor);
  const request = await requests.findRequest(prisma, requestId);
  if (!request) throw notFound("Request");
  const approve = input.action === "approve";
  await runInTransaction(async (tx) => {
    const closed = await requests.closeRequest(tx, requestId, {
      status: approve ? "APPROVED" : "REJECTED",
      decidedById: actor.id,
      decidedAt: now,
      decisionNote: input.note ?? null,
    });
    if (!closed) throw conflict("This request was already decided or cancelled.");
    if (!approve) return;
    if ((await billing.findBilling(tx, request.businessId))?.stripeSubscriptionId) {
      throw conflict("This business pays by card now; its plan comes from Stripe.");
    }
    await addPlanMonths(tx, request.businessId, request.plan, request.months, now);
    await money.createPlanPayment(tx, {
      businessId: request.businessId,
      plan: request.plan,
      amountCents: request.amountCents,
      currency: request.currency,
      method: request.method,
      providerRef: `manual:${request.id}`,
      status: "PAID",
      paidAt: now,
    });
  });
  await logActivity(prisma, {
    userId: actor.id,
    businessId: request.businessId,
    action: approve ? "plan.approved" : "plan.rejected",
    entity: "plan_request",
    entityId: requestId,
  });
}
