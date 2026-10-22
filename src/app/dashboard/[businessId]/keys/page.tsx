import { getLocale, getTranslations } from "next-intl/server";
import { KeyManager } from "@/components/dashboard/key-manager";
import { env } from "@/server/env";
import { requirePageAccess } from "@/server/http/session";
import { listKeys, listToolCalls } from "@/server/services/api-key-service";

type PageProps = { params: Promise<{ businessId: string }> };

export default async function KeysPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageAccess(businessId, ["ai.use"]);
  const [t, locale, keys, calls] = await Promise.all([
    getTranslations("assistant.keys"),
    getLocale(),
    listKeys(ctx),
    listToolCalls(ctx, 20),
  ]);
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <header className="rise-in">
        <h1 className="text-4xl font-semibold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted">{t("intro")}</p>
      </header>
      <KeyManager
        businessId={businessId}
        mcpUrl={`${env.BETTER_AUTH_URL}/api/mcp`}
        keys={keys.map((key) => ({
          ...key,
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          expiresAt: key.expiresAt?.toISOString() ?? null,
        }))}
      />
      <section className="grid gap-3">
        <h2 className="text-2xl font-semibold">{t("auditTitle")}</h2>
        <p className="text-sm text-muted">{t("auditHint")}</p>
        {calls.length === 0 ? (
          <p className="text-muted">{t("noCalls")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
            {calls.map((call) => (
              <li
                key={call.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <code className="font-semibold">{call.tool}</code>
                <span className="text-muted">
                  {call.channel} · {call.outcome === "ok" ? t("ok") : call.outcome} · {call.latencyMs} ms ·{" "}
                  {when.format(call.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
