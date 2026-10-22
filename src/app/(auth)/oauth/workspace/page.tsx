import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { WorkspacePicker } from "@/components/account/oauth-steps";
import { getCurrentUser } from "@/server/http/session";
import { listConnectableWorkspaces } from "@/server/services/mcp-oauth-service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("oauth");
  return { title: t("workspaceTitle"), robots: { index: false } };
}

/** Step 2 of connecting an AI app: which workspace it may act in. */
export default async function OAuthWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const [t, workspaces] = await Promise.all([getTranslations("oauth"), listConnectableWorkspaces(user.id)]);
  return (
    <>
      <h1 className="font-poster text-[2rem]">{t("workspaceTitle")}</h1>
      <p className="mt-3 mb-8 text-muted">{t("workspaceBody")}</p>
      {workspaces.length === 0 ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm">{t("noWorkspace")}</p>
      ) : (
        <WorkspacePicker workspaces={workspaces} />
      )}
    </>
  );
}
