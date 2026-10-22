"use client";

import { KeyRound, Trash2, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { type ConfirmOptions, useConfirm } from "@/components/ui/confirm-dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/ui/copy-field";
import { inputClass } from "@/components/ui/field";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

interface KeyManagerProps {
  businessId: string;
  mcpUrl: string;
  keys: Array<{
    id: string;
    name: string;
    prefix: string;
    canWrite: boolean;
    lastUsedAt: string | null;
    expiresAt: string | null;
  }>;
}

export function KeyManager({ businessId, mcpUrl, keys }: KeyManagerProps) {
  const t = useTranslations("assistant.keys");
  const locale = useLocale();
  const { run, pending, error } = useAction();
  const tConfirm = useTranslations("confirm");
  const [ask, confirmDialog] = useConfirm();
  /** Runs `action` only after the person confirms. */
  const confirmThen = async (options: ConfirmOptions, action: () => Promise<unknown>) => {
    if ((await ask(options)).confirmed) run(action);
  };
  const [secret, setSecret] = useState<string | null>(null);

  const create = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(async () => {
      const key = await api.post<{ secret: string }>(`/api/workspaces/${businessId}/keys`, {
        name: data.get("name"),
        canWrite: data.get("canWrite") === "on",
        expiresInDays: Number(data.get("expires")) || null,
      });
      setSecret(key.secret);
      form.reset();
    });
  };

  return (
    <div className="grid gap-8">
      {confirmDialog}
      <form onSubmit={create} className="grid gap-4 rounded-xl bg-surface p-5 ring-1 ring-line">
        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <KeyRound className="size-4 text-accent" aria-hidden />
          {t("create")}
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <input
            name="name"
            required
            minLength={2}
            maxLength={60}
            placeholder={t("namePlaceholder")}
            aria-label={t("name")}
            className={inputClass}
          />
          <select name="expires" defaultValue="90" aria-label={t("expires")} className={inputClass}>
            <option value="30">{t("days", { count: 30 })}</option>
            <option value="90">{t("days", { count: 90 })}</option>
            <option value="365">{t("days", { count: 365 })}</option>
            <option value="">{t("never")}</option>
          </select>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="canWrite" className="mt-0.5 size-4 accent-(--accent)" />
          <span>
            <span className="font-semibold">{t("allowWrite")}</span>
            <span className="block text-muted">{t("allowWriteHint")}</span>
          </span>
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {t("generate")}
          </Button>
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </div>
      </form>

      <AnimatePresence>
        {secret && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid gap-4 rounded-xl bg-accent-soft p-5 ring-1 ring-accent-line"
          >
            <p className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="size-4 text-warning" aria-hidden />
              {t("copyNow")}
            </p>
            <CopyField value={secret} label={t("secret")} />
            <div className="grid gap-2">
              <p className="text-sm font-semibold">{t("claudeCode")}</p>
              <CopyField
                value={`claude mcp add --transport http mabeet ${mcpUrl} --header "Authorization: Bearer ${secret}"`}
                label={t("claudeCode")}
              />
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-semibold">{t("desktop")}</p>
              <CopyField
                value={JSON.stringify({
                  mcpServers: {
                    mabeet: {
                      command: "npx",
                      args: ["mcp-remote", mcpUrl, "--header", `Authorization: Bearer ${secret}`],
                    },
                  },
                })}
                label={t("desktop")}
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="justify-self-start"
              onClick={() => setSecret(null)}
            >
              {t("done")}
            </Button>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="grid gap-3">
        <h2 className="text-2xl font-semibold">{t("yourKeys")}</h2>
        {keys.length === 0 ? (
          <p className="text-muted">{t("noKeys")}</p>
        ) : (
          <ul className="grid gap-2">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-4 ring-1 ring-line"
              >
                <div>
                  <p className="font-semibold">
                    {key.name} <code className="ms-2 text-xs text-muted">{key.prefix}…</code>
                  </p>
                  <p className="text-sm text-muted">
                    {key.canWrite ? t("readWrite") : t("readOnly")} ·{" "}
                    {key.lastUsedAt
                      ? t("lastUsed", { when: new Date(key.lastUsedAt).toLocaleString(locale) })
                      : t("neverUsed")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    void confirmThen(
                      {
                        title: tConfirm("revokeKey.title", { name: key.name }),
                        body: tConfirm("revokeKey.body"),
                        confirmLabel: tConfirm("revokeKey.confirm"),
                        danger: true,
                      },
                      () => api.delete(`/api/workspaces/${businessId}/keys/${key.id}`),
                    )
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                  {t("revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
