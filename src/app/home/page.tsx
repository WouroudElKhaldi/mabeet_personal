import { redirect } from "next/navigation";
import { requirePageUser } from "@/server/http/session";
import { listWorkspaces } from "@/server/services/team-service";

/** Where everyone lands after signing in: admins to /admin, hosts and staff to their dashboard, guests home. */
export default async function HomeAfterSignIn() {
  const user = await requirePageUser();
  if (user.platformRole === "SUPER_ADMIN") redirect("/admin");
  const [first] = await listWorkspaces(user.id);
  redirect(first ? `/dashboard/${first.businessId}` : "/");
}
