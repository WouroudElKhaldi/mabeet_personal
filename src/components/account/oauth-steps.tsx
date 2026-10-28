"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { useRedirectAction } from "@/hooks/use-redirect-action";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

// The two screens between signing in and an AI app getting its token. The signed OAuth request rides
// along in this page's address; authClient's oauthProviderClient plugin sends it with each step.

type OAuthStepResult = { data: unknown; error: { message?: string } | null };

/** Runs one OAuth step and follows the redirect Better Auth answers with (`url`, or `uri` on consent). */
function useOAuthStep() {
  const t = useTranslations("oauth");
  const { go, pending, error } = useRedirectAction(t("failed"));
  const run = (step: () => Promise<OAuthStepResult>) =>
    go(async () => {
      const result = await step();
      const next = result.data as { url?: string; uri?: string } | null;
      const url = next?.url ?? next?.uri;
      if (result.error || !url) throw new Error(result.error?.message);
      return url;
    });
  return { run, pending, error };
}

export function WorkspacePicker({
  workspaces,
}: {
  workspaces: Array<{ id: string; name: string; role: string }>;
}) {
  const t = useTranslations("oauth");
  const [picked, setPicked] = useState(workspaces[0]?.id ?? "");
  const { run, pending, error } = useOAuthStep();

  const next = () =>
    run(async () => {
      await api.post("/api/oauth/workspace", { businessId: picked });
      return authClient.oauth2.continue({ postLogin: true });
    });

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="sr-only">{t("workspaceTitle")}</legend>
        {workspaces.map((workspace) => (
          <label
            key={workspace.id}
            className={clsx(
              "flex cursor-pointer items-center justify-between gap-3 rounded-xl p-4 ring-1 transition-colors",
              picked === workspace.id
                ? "bg-surface-2 ring-2 ring-accent"
                : "ring-line-strong hover:bg-surface-2",
            )}
          >
            <span>
              <span className="block font-semibold">{workspace.name}</span>
              <span className="text-sm text-muted">{workspace.role}</span>
            </span>
            <input
              type="radio"
              name="workspace"
              value={workspace.id}
              checked={picked === workspace.id}
              onChange={() => setPicked(workspace.id)}
              className="size-4 accent-accent"
            />
          </label>
        ))}
      </fieldset>
      <Button size="lg" disabled={!picked || pending} onClick={next}>
        {t("continue")}
      </Button>
      <FormError message={error} />
    </div>
  );
}

export function ConsentButtons() {
  const t = useTranslations("oauth");
  const { run, pending, error } = useOAuthStep();
  return (
    <div className="grid gap-3">
      <Button
        size="lg"
        disabled={pending}
        onClick={() => run(() => authClient.oauth2.consent({ accept: true }))}
      >
        {t("allow")}
      </Button>
      <Button
        size="lg"
        variant="secondary"
        disabled={pending}
        onClick={() => run(() => authClient.oauth2.consent({ accept: false }))}
      >
        {t("deny")}
      </Button>
      <FormError message={error} />
    </div>
  );
}
