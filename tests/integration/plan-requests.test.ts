import { beforeEach, describe, expect, it } from "vitest";
import { assertPlanAllowsAi, runPlanHousekeeping } from "@/server/services/billing-service";
import {
  addPaymentOption,
  cancelPlanRequest,
  decidePlanRequest,
  getReceiptForBusiness,
  listPaymentOptions,
  requestPlan,
} from "@/server/services/plan-request-service";
import { createPlace, createUser, memberWith, prisma, resetDatabase } from "./helpers";

// Paying Mabeet for a plan by hand: the host sends a receipt, nothing changes until a super admin approves,
// then the plan starts at once for the months paid and counts as revenue.

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PDF = new Uint8Array([...new TextEncoder().encode("%PDF-1.7\n"), 1, 2, 3]);
const DAY = 24 * 60 * 60 * 1000;

describe("plans paid by hand", () => {
  let place: Awaited<ReturnType<typeof createPlace>>;
  let admin: { id: string; platformRole: string };
  let optionId: string;

  beforeEach(async () => {
    await resetDatabase();
    place = await createPlace("Beit Manual", "FREE");
    const user = await createUser("Founder");
    await prisma.user.update({ where: { id: user.id }, data: { platformRole: "SUPER_ADMIN" } });
    admin = { id: user.id, platformRole: "SUPER_ADMIN" };
    optionId = (
      await addPaymentOption(admin, {
        method: "BANK_TRANSFER",
        label: "Bank Audi (USD)",
        details: "IBAN LB00 0000",
        active: true,
        position: 0,
      })
    ).id;
  });

  const ask = (months = 3, receipt: Uint8Array<ArrayBuffer> = PNG) =>
    requestPlan(place.ctx, { plan: "PRO", months, optionId, payerReference: "TR-1", note: null, receipt });

  it("lists only the ways to pay the admin left active, and only admins edit them", async () => {
    await addPaymentOption(admin, {
      method: "CRYPTO",
      label: "USDT",
      details: "T...",
      active: false,
      position: 1,
    });
    expect((await listPaymentOptions()).map((option) => option.label)).toEqual(["Bank Audi (USD)"]);
    await expect(
      addPaymentOption(
        { id: place.owner.id, platformRole: "USER" },
        {
          method: "CASH",
          label: "Office",
          details: "Hamra",
          active: true,
          position: 0,
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("changes nothing until approved, then starts the plan for the months paid and records the revenue", async () => {
    const request = await ask(3);
    expect(request).toMatchObject({ status: "PENDING", amountCents: 3_000, method: "BANK_TRANSFER" });
    await expect(assertPlanAllowsAi(place.business.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const now = new Date();
    await decidePlanRequest(admin, request.id, { action: "approve", note: null }, now);
    const business = await prisma.business.findUniqueOrThrow({ where: { id: place.business.id } });
    expect(business.plan).toBe("PRO");
    expect(business.planRenewsAt!.getTime() - now.getTime()).toBe(90 * DAY);
    await expect(assertPlanAllowsAi(place.business.id)).resolves.toBeUndefined();
    expect(await prisma.planPayment.findMany({ where: { businessId: place.business.id } })).toEqual([
      expect.objectContaining({ status: "PAID", amountCents: 3_000, method: "BANK_TRANSFER" }),
    ]);

    // Decided once: a second approval changes nothing and is refused.
    await expect(decidePlanRequest(admin, request.id, { action: "approve" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await prisma.planPayment.count()).toBe(1);
  });

  it("adds a renewal after the months already paid, and goes back to Free when they run out", async () => {
    const now = new Date();
    await decidePlanRequest(admin, (await ask(1)).id, { action: "approve" }, now);
    await decidePlanRequest(admin, (await ask(1)).id, { action: "approve" }, now);
    const { planRenewsAt } = await prisma.business.findUniqueOrThrow({ where: { id: place.business.id } });
    expect(planRenewsAt!.getTime() - now.getTime()).toBe(60 * DAY);

    await runPlanHousekeeping(new Date(now.getTime() + 61 * DAY));
    expect((await prisma.business.findUniqueOrThrow({ where: { id: place.business.id } })).plan).toBe("FREE");
  });

  it("keeps one request waiting at a time, enforced by the database", async () => {
    const first = await ask();
    await expect(ask()).rejects.toMatchObject({ code: "CONFLICT" });
    await cancelPlanRequest(place.ctx, first.id);
    await expect(ask(1, PDF)).resolves.toMatchObject({ status: "PENDING", receiptMime: "application/pdf" });
  });

  it("rejects without touching the plan, and keeps the admin's note for the host", async () => {
    const request = await ask();
    await decidePlanRequest(admin, request.id, { action: "reject", note: "Transfer not received" });
    expect((await prisma.business.findUniqueOrThrow({ where: { id: place.business.id } })).plan).toBe("FREE");
    expect(await prisma.planRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({
      status: "REJECTED",
      decisionNote: "Transfer not received",
    });
    expect(await prisma.planPayment.count()).toBe(0);
  });

  it("refuses a file that is not an image or PDF, a way to pay that isn't listed, and non-owners", async () => {
    await expect(
      ask(1, new Uint8Array(new TextEncoder().encode("<script>alert(1)</script>"))),
    ).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(
      requestPlan(place.ctx, { plan: "PRO", months: 1, optionId: "nope", receipt: PNG }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const staff = await memberWith(place.business.id, ["settings.manage"]);
    await expect(
      requestPlan(staff, { plan: "PRO", months: 1, optionId, receipt: PNG }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("shows a receipt only to its own business", async () => {
    const request = await ask();
    await expect(getReceiptForBusiness(place.ctx, request.id)).resolves.toMatchObject({
      receiptMime: "image/png",
    });
    const other = await createPlace("Beit Other");
    await expect(getReceiptForBusiness(other.ctx, request.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("doesn't take a manual plan on top of a card subscription", async () => {
    await prisma.business.update({
      where: { id: place.business.id },
      data: { stripeSubscriptionId: "sub_1", plan: "PRO" },
    });
    await expect(ask()).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
