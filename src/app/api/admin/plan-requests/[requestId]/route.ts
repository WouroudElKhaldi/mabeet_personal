import { z } from "zod";
import { json, parseBody, parseParams, requireUser, route } from "@/server/http/route";
import { decidePlanRequest } from "@/server/services/plan-request-service";
import { planRequestDecision } from "@/server/validation/schemas";

const params = z.object({ requestId: z.string().min(1).max(64) });

/** Approve (the plan starts now, for the months paid) or reject, with a note the host sees. */
export const POST = route(async (request, context) => {
  const user = await requireUser(request);
  const { requestId } = await parseParams(context, params);
  await decidePlanRequest(user, requestId, await parseBody(request, planRequestDecision));
  return json({ ok: true });
});
