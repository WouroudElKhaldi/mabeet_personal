import { z } from "zod";
import { json, parseBody, parseParams, requireUser, route } from "@/server/http/route";
import { decidePayout } from "@/server/services/payout-service";
import { payoutDecisionInput } from "@/server/validation/schemas";

const params = z.object({ payoutId: z.string().min(1).max(64) });

/** A platform admin marks a payout request as sent (with its transfer reference) or rejects it. */
export const POST = route(async (request, context) => {
  const user = await requireUser(request);
  const { payoutId } = await parseParams(context, params);
  await decidePayout(user, payoutId, await parseBody(request, payoutDecisionInput));
  return json({ ok: true });
});
