import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HostProfileForm } from "@/components/dashboard/host-profile-form";
import { PageHeader } from "@/components/shell/page-header";
import { PasswordForm, ProfileForm } from "@/components/shell/profile-forms";
import { requirePageTenant } from "@/server/http/session";
import { getMyProfile } from "@/server/services/account-service";
import { getMyHostProfile } from "@/server/services/host-service";

type PageProps = { params: Promise<{ businessId: string }> };

/** The signed-in person's own profile: details and password, and for owners their host profile. */
export default async function DashboardProfilePage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  const host = ctx.isOwner && !ctx.platformAdmin;
  const [t, tHost, profile, hostProfile] = await Promise.all([
    getTranslations("profile"),
    getTranslations("hostProfile"),
    getMyProfile(ctx.userId),
    host ? getMyHostProfile(ctx) : null,
  ]);
  if (!profile) notFound();
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid max-w-3xl gap-6">
        <ProfileForm profile={profile} />
        {host && (
          <section className="grid gap-3">
            <div>
              <h2 className="text-xl font-semibold">{tHost("title")}</h2>
              <p className="mt-1 text-sm text-muted">{tHost("intro")}</p>
            </div>
            <HostProfileForm businessId={businessId} profile={hostProfile} />
          </section>
        )}
        <PasswordForm />
      </div>
    </>
  );
}
