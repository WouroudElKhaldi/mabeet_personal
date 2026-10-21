"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import type { Permission } from "@/server/auth/permissions";
import { useAction } from "@/hooks/use-action";

export interface EditableRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isOwner: boolean;
  memberCount: number;
}

interface RoleEditorProps {
  businessId: string;
  role?: EditableRole;
  /** Permissions the editor may toggle: the ones the acting member holds. */
  grantable: readonly Permission[];
  allPermissions: readonly Permission[];
}

/** Creates a role when `role` is absent; owners' role is shown read-only. */
export function RoleEditor({ businessId, role, grantable, allPermissions }: RoleEditorProps) {
  const t = useTranslations("dashboard.team");
  const tPermission = useTranslations("permissions");
  const { run, pending, error } = useAction();
  const locked = role?.isOwner ?? false;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      name: String(data.get("name")),
      description: String(data.get("description")) || null,
      permissions: data.getAll("permissions"),
    };
    run(
      () =>
        role
          ? api.patch(`/api/workspaces/${businessId}/roles/${role.id}`, body)
          : api.post(`/api/workspaces/${businessId}/roles`, body),
      () => !role && form.reset(),
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <fieldset disabled={locked || pending} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            {t("roleName")}
            <input
              name="name"
              required
              minLength={2}
              maxLength={40}
              defaultValue={role?.name}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            {t("roleDescription")}
            <input
              name="description"
              maxLength={200}
              defaultValue={role?.description ?? ""}
              className={inputClass}
            />
          </label>
        </div>
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">{t("permissions")}</legend>
          {allPermissions.map((permission) => {
            const allowed = grantable.includes(permission);
            return (
              <label
                key={permission}
                className="flex items-start gap-3 rounded-md p-3 ring-1 ring-line transition-colors has-checked:bg-accent-soft has-checked:ring-accent-line has-disabled:opacity-50"
              >
                <input
                  type="checkbox"
                  name="permissions"
                  value={permission}
                  defaultChecked={locked || role?.permissions.includes(permission)}
                  disabled={!allowed}
                  className="mt-0.5 size-4 accent-(--accent)"
                />
                <span className="grid">
                  <span className="text-sm font-semibold">{tPermission(`${permission}.title`)}</span>
                  <span className="text-xs text-muted">{tPermission(`${permission}.description`)}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      </fieldset>
      {!locked && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {role ? t("saveRole") : t("createRole")}
          </Button>
          {role && role.memberCount === 0 && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => api.delete(`/api/workspaces/${businessId}/roles/${role.id}`))}
            >
              <Trash2 className="size-4" aria-hidden />
              {t("deleteRole")}
            </Button>
          )}
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
