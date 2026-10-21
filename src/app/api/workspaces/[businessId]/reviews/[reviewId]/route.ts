import { json, parseBody, parseParams, requireTenant, route } from "@/server/http/route";
import { replyToReview, setReviewVisibility } from "@/server/services/review-service";
import { reviewParams, reviewUpdate } from "@/server/validation/schemas";

export const PATCH = route(async (request, context) => {
  const { businessId, reviewId } = await parseParams(context, reviewParams);
  const ctx = await requireTenant(request, businessId);
  const update = await parseBody(request, reviewUpdate);
  if ("reply" in update) await replyToReview(ctx, reviewId, update.reply);
  else await setReviewVisibility(ctx, reviewId, update.hiddenReason);
  return json({ ok: true });
});
