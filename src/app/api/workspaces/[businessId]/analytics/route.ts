import { json, parseQuery, tenantRoute } from "@/server/http/route";
import { getBusinessReport } from "@/server/services/analytics-service";
import { dateWindow, workspaceParams } from "@/server/validation/schemas";

export const GET = tenantRoute(workspaceParams, async ({ request, ctx }) => {
  return json(await getBusinessReport(ctx, parseQuery(request, dateWindow)));
});
