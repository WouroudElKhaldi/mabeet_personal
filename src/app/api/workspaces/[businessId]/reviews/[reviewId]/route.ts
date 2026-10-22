import { json, parseBody, tenantRoute } from "@/server/http/route";
import { replyToReview, setReviewVisibility } from "@/server/services/review-service";
import { reviewParams, reviewUpdate } from "@/server/validation/schemas";

export const PATCH = tenantRoute(reviewParams, async ({ request, ctx, params: { reviewId } }) => {
  const update = await parseBody(request, reviewUpdate);
  if ("reply" in update) await replyToReview(ctx, reviewId, update.reply);
  else await setReviewVisibility(ctx, reviewId, update.hiddenReason);
  return json({ ok: true });
});
