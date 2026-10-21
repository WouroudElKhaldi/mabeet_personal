import { json, parseParams, parseQuery, requireTenant, route } from "@/server/http/route";
import { getBusinessReport } from "@/server/services/analytics-service";
import { dateWindow, workspaceParams } from "@/server/validation/schemas";

export const GET = route(async (request, context) => {
  const { businessId } = await parseParams(context, workspaceParams);
  const ctx = await requireTenant(request, businessId);
  return json(await getBusinessReport(ctx, parseQuery(request, dateWindow)));
});
