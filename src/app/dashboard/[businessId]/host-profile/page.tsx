import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HostProfileForm } from "@/components/dashboard/host-profile-form";
import { PageHeader } from "@/components/shell/page-header";
import { requirePageTenant } from "@/server/http/session";
import { getMyHostProfile } from "@/server/services/host-service";

type PageProps = { params: Promise<{ businessId: string }> };

/** The owner's own profile as a host, shared by all their businesses. Owners only. */
export default async function HostProfilePage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  if (!ctx.isOwner) notFound();
  const [t, profile] = await Promise.all([getTranslations("hostProfile"), getMyHostProfile(ctx)]);
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <HostProfileForm businessId={businessId} profile={profile} />
    </>
  );
}
