import { invalid } from "@/server/errors";
import { json, tenantRoute } from "@/server/http/route";
import { listMyPlanRequests, requestPlan } from "@/server/services/plan-request-service";
import { planRequestFields, workspaceParams } from "@/server/validation/schemas";

/** The business's requests for a plan paid by hand. Owners only. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) => json(await listMyPlanRequests(ctx)));

/** Multipart: `plan`, `months`, `optionId` (how they paid), `payerReference`, `note`, and the `receipt` file. */
export const POST = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  const form = await request.formData().catch(() => {
    throw invalid("Send the request as multipart form data");
  });
  const receipt = form.get("receipt");
  if (!(receipt instanceof File)) throw invalid("Attach the receipt or a screenshot of the payment");
  const text = (name: string) => (form.get(name) as string | null) || null;
  const fields = planRequestFields.parse({
    plan: text("plan"),
    months: text("months") ?? 1,
    optionId: text("optionId"),
    payerReference: text("payerReference"),
    note: text("note"),
  });
  const created = await requestPlan(ctx, { ...fields, receipt: new Uint8Array(await receipt.arrayBuffer()) });
  return json(created, 201);
});
