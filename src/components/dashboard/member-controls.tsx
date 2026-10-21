"use client";

import { UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { useAction } from "@/hooks/use-action";

interface RoleOption {
  id: string;
  name: string;
}

export function MemberControls({
  businessId,
  membershipId,
  roleId,
  roles,
}: {
  businessId: string;
  membershipId: string;
  roleId: string;
  roles: RoleOption[];
}) {
  const t = useTranslations("dashboard.team");
  const { run, pending, error } = useAction();
  const base = `/api/workspaces/${businessId}/members/${membershipId}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={t("role")}
        defaultValue={roleId}
        disabled={pending}
        onChange={(event) => run(() => api.patch(base, { roleId: event.target.value }))}
        className={`${inputClass} h-10 w-44`}
      >
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("remove")}
        disabled={pending}
        onClick={() => run(() => api.delete(base))}
      >
        <UserMinus className="size-4" aria-hidden />
      </Button>
      {error && <span className="text-xs font-semibold text-danger">{error}</span>}
    </div>
  );
}

export function AddMemberForm({ businessId, roles }: { businessId: string; roles: RoleOption[] }) {
  const t = useTranslations("dashboard.team");
  const { run, pending, error } = useAction();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    run(
      () =>
        api.post(`/api/workspaces/${businessId}/members`, {
          email: data.get("email"),
          roleId: data.get("roleId"),
        }),
      () => form.reset(),
    );
  };
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
      <input
        name="email"
        type="email"
        required
        placeholder={t("emailPlaceholder")}
        aria-label={t("email")}
        className={inputClass}
      />
      <select name="roleId" aria-label={t("role")} className={inputClass}>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      <Button type="submit" className="h-12" disabled={pending}>
        {t("add")}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger sm:col-span-3">
          {error}
        </p>
      )}
    </form>
  );
}
