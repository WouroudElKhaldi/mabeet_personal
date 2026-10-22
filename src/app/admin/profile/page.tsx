import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shell/page-header";
import { PasswordForm, ProfileForm } from "@/components/shell/profile-forms";
import { requirePageUser } from "@/server/http/session";
import { getMyProfile } from "@/server/services/account-service";

/** The admin's own profile: details and password. */
export default async function AdminProfilePage() {
  const user = await requirePageUser();
  const [t, profile] = await Promise.all([getTranslations("profile"), getMyProfile(user.id)]);
  if (!profile) notFound();
  return (
    <>
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="grid max-w-3xl gap-6">
        <ProfileForm profile={profile} />
        <PasswordForm />
      </div>
    </>
  );
}
