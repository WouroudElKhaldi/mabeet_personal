import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import type { TenantContext } from "@/server/auth/tenant-context";
import { env } from "@/server/env";
import { authenticateKey } from "@/server/services/api-key-service";
import { contextForToken, MCP_RESOURCE, MCP_SCOPES } from "@/server/services/mcp-oauth-service";
import { auth } from "./better-auth";

// Who is calling the host MCP server: an API key (mbt_…) made in the dashboard, or an OAuth access token
// from an AI app that went through sign-in, workspace choice and consent.

const resourceClient = oauthProviderResourceClient(auth).getActions();
// Given explicitly: derived from the auth options, both would miss Better Auth's default /api/auth base path
// and every token would be rejected.
const ISSUER = new URL("/api/auth", env.BETTER_AUTH_URL).toString();
const JWKS_URL = `${ISSUER}/jwks`;

export interface McpCaller {
  ctx: TenantContext;
  /** For rate limiting and the audit log. */
  rateKey: string;
  apiKeyId?: string;
}

/** Where AI apps learn how to get a token for this server (RFC 9728). */
export const MCP_RESOURCE_METADATA_URL = new URL(
  "/.well-known/oauth-protected-resource/api/mcp",
  MCP_RESOURCE,
).toString();

export async function authenticateMcpCaller(request: Request): Promise<McpCaller | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return null;
  if (token.startsWith("mbt_")) {
    const key = await authenticateKey(token);
    return key && { ctx: key.ctx, rateKey: `mcp:${key.keyId}`, apiKeyId: key.keyId };
  }
  try {
    const payload = await resourceClient.verifyAccessTokenRequest(request, {
      verifyOptions: { audience: MCP_RESOURCE, issuer: ISSUER },
      jwksUrl: JWKS_URL,
      requiredScopes: [MCP_SCOPES.read],
    });
    const scopes = typeof payload.scope === "string" ? payload.scope.split(" ") : [];
    const businessId = payload.business_id;
    if (typeof payload.sub !== "string" || typeof businessId !== "string") return null;
    const ctx = await contextForToken(payload.sub, businessId, scopes);
    return ctx && { ctx, rateKey: `mcp:oauth:${payload.sub}:${businessId}` };
  } catch {
    // Expired, wrong audience, bad signature or missing scope: all mean "get a new token".
    return null;
  }
}

/** Metadata for /.well-known/oauth-protected-resource. */
export function mcpResourceMetadata() {
  return resourceClient.getProtectedResourceMetadata({
    resource: MCP_RESOURCE,
    scopes_supported: [MCP_SCOPES.read, MCP_SCOPES.write],
    bearer_methods_supported: ["header"],
    resource_name: "Mabeet host MCP",
  });
}
