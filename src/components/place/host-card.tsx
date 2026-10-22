import { MessageCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getPublicHost } from "@/server/services/host-service";

/** "Your host": only for hosts who chose to show their profile on their listings. */
export async function HostCard({ businessId }: { businessId: string }) {
  const host = await getPublicHost(businessId);
  if (!host?.hostProfile) return null;
  const [t, tLang] = await Promise.all([
    getTranslations("hostProfile"),
    getTranslations("listing.languages"),
  ]);
  const profile = host.hostProfile;
  const name = profile.displayName ?? host.name;
  const whatsapp = profile.whatsapp?.replace(/\D/g, "");
  const facts = [
    profile.city,
    profile.hostingSince ? t("hostingSinceShort", { year: profile.hostingSince }) : null,
    profile.languages.length > 0
      ? profile.languages.map((code) => tLang(code as "ar" | "en" | "fr")).join(" · ")
      : null,
  ].filter(Boolean);
  return (
    <section className="border-t border-line py-8">
      <h2 className="text-xl font-semibold">{t("yourHost")}</h2>
      <div className="mt-4 flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-lg font-bold text-accent-ink">
          {name
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase())
            .join("")}
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{name}</p>
          {facts.length > 0 && <p className="text-sm text-muted">{facts.join(" · ")}</p>}
          {profile.bio && <p className="mt-3 leading-relaxed whitespace-pre-line">{profile.bio}</p>}
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
            >
              <MessageCircle className="size-4" aria-hidden />
              {t("message")}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
