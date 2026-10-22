"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

// The two screens between signing in and an AI app getting its token. The signed OAuth request rides
// along in this page's address; authClient's oauthProviderClient plugin sends it with each step.

function useOAuthStep() {
  const t = useTranslations("oauth");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (step: () => Promise<{ data: unknown; error: { message?: string } | null }>) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await step();
        const next = (result.data as { url?: string; uri?: string } | null) ?? null;
        const url = next?.url ?? next?.uri;
        if (result.error || !url) throw new Error(result.error?.message);
        window.location.assign(url);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : t("failed"));
      }
    });
  return { run, pending, error };
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm font-semibold text-danger">
      {error}
    </p>
  ) : null;
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
              className="size-4 accent-(--accent)"
            />
          </label>
        ))}
      </fieldset>
      <Button size="lg" disabled={!picked || pending} onClick={next}>
        {t("continue")}
      </Button>
      <ErrorLine error={error} />
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
      <ErrorLine error={error} />
    </div>
  );
}
