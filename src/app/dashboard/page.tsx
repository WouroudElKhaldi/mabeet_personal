import { redirect } from "next/navigation";
import { requirePageUser } from "@/server/http/session";
import { listWorkspaces } from "@/server/services/team-service";

/** Sends members to their first workspace, and everyone else to create one. */
export default async function DashboardIndex() {
  const user = await requirePageUser();
  const [first] = await listWorkspaces(user.id);
  redirect(first ? `/dashboard/${first.businessId}` : "/host");
}
