import { PrivacyControls } from "@/components/account/privacy-controls";
import { requirePageUser } from "@/server/http/session";

export default async function PrivacyPage() {
  const user = await requirePageUser();
  return <PrivacyControls email={user.email} />;
}
