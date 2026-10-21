import { getTranslations } from "next-intl/server";
import { AddMemberForm, MemberControls } from "@/components/dashboard/member-controls";
import { RoleEditor } from "@/components/dashboard/role-editor";
import { ALL_PERMISSIONS } from "@/server/auth/permissions";
import { can } from "@/server/auth/tenant-context";
import { requirePageTenant } from "@/server/http/session";
import { listMembers, listRoleOptions, listRoles } from "@/server/services/team-service";

type PageProps = { params: Promise<{ businessId: string }> };

export default async function TeamPage({ params }: PageProps) {
  const { businessId } = await params;
  const ctx = await requirePageTenant(businessId);
  const canManageTeam = can(ctx, "team.manage");
  const canManageRoles = can(ctx, "roles.manage");
  const [t, members, roleOptions, roles] = await Promise.all([
    getTranslations("dashboard.team"),
    canManageTeam ? listMembers(ctx) : [],
    canManageTeam ? listRoleOptions(ctx) : [],
    canManageRoles ? listRoles(ctx) : [],
  ]);
  const grantable = ALL_PERMISSIONS.filter((permission) => ctx.permissions.has(permission));

  return (
    <div className="grid gap-12">
      <h1 className="rise-in text-4xl font-medium">{t("title")}</h1>

      {canManageTeam && (
        <section className="grid gap-4">
          <h2 className="text-2xl font-medium">{t("members")}</h2>
          <ul className="grid gap-2">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-4 ring-1 ring-line"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {member.user.name}
                    {member.id === ctx.membershipId && (
                      <span className="ms-2 text-sm text-muted">({t("you")})</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted">{member.user.email}</p>
                </div>
                {member.id === ctx.membershipId ? (
                  <span className="text-sm font-semibold">{member.role.name}</span>
                ) : (
                  <MemberControls
                    businessId={businessId}
                    membershipId={member.id}
                    roleId={member.role.id}
                    roles={roleOptions}
                  />
                )}
              </li>
            ))}
          </ul>
          <AddMemberForm businessId={businessId} roles={roleOptions} />
        </section>
      )}

      {canManageRoles && (
        <section className="grid gap-4">
          <div>
            <h2 className="text-2xl font-medium">{t("roles")}</h2>
            <p className="mt-1 max-w-2xl text-muted">{t("rolesIntro")}</p>
          </div>
          {roles.map((role) => (
            <details key={role.id} className="rounded-xl bg-surface ring-1 ring-line open:shadow-soft">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
                <span>
                  <span className="font-display text-lg font-semibold">{role.name}</span>
                  {role.description && <span className="ms-3 text-sm text-muted">{role.description}</span>}
                </span>
                <span className="text-sm text-muted">
                  {t("memberCount", { count: role._count.memberships })}
                </span>
              </summary>
              <div className="border-t border-line p-5">
                <RoleEditor
                  businessId={businessId}
                  role={{ ...role, memberCount: role._count.memberships }}
                  grantable={grantable}
                  allPermissions={ALL_PERMISSIONS}
                />
              </div>
            </details>
          ))}
          <div className="rounded-xl border border-dashed border-line-strong p-5">
            <h3 className="mb-4 font-display text-lg font-semibold">{t("newRole")}</h3>
            <RoleEditor businessId={businessId} grantable={grantable} allPermissions={ALL_PERMISSIONS} />
          </div>
        </section>
      )}
    </div>
  );
}
