import { json, parseBody, tenantRoute } from "@/server/http/route";
import { getMyHostProfile, saveMyHostProfile } from "@/server/services/host-service";
import { hostProfileInput, workspaceParams } from "@/server/validation/schemas";

/** The signed-in owner's own host profile. It belongs to the person, whichever of their businesses this is. */
export const GET = tenantRoute(workspaceParams, async ({ ctx }) =>
  json({ profile: await getMyHostProfile(ctx) }),
);

/** Saves the host profile, and whether guests see it on the host's listings. Owners only. */
export const PUT = tenantRoute(workspaceParams, async ({ request, ctx }) =>
  json({ profile: await saveMyHostProfile(ctx, await parseBody(request, hostProfileInput)) }),
);
