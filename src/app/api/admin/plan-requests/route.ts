import { z } from "zod";
import { json, parseQuery, requireUser, route } from "@/server/http/route";
import { listPlanRequests } from "@/server/services/plan-request-service";

const query = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional() });

/** Every business's requests for a plan paid by hand, waiting ones first. */
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const { status } = parseQuery(request, query);
  return json(await listPlanRequests(user, status ?? null));
});
