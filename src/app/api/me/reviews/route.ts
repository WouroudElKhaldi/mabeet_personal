import { json, parseBody, requireUser, route } from "@/server/http/route";
import { submitReview } from "@/server/services/review-service";
import { reviewInput } from "@/server/validation/schemas";

export const POST = route(async (request) => {
  const user = await requireUser(request);
  return json(await submitReview(user.id, await parseBody(request, reviewInput)), 201);
});
