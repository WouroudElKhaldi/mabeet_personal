"use client";

import { UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { api } from "@/lib/api-client";
import { useAction } from "@/hooks/use-action";

interface RoleOption {
  id: string;
  name: string;
}

export function MemberControls({
  businessId,
  membershipId,
  memberName,
  roleId,
  roles,
}: {
  businessId: string;
  membershipId: string;
  memberName: string;
  roleId: string;
  roles: RoleOption[];
}) {
  const t = useTranslations("dashboard.team");
  const tConfirm = useTranslations("confirm");
  const { run, pending, error } = useAction();
  const [ask, confirmDialog] = useConfirm();
  const [selected, setSelected] = useState(roleId);
  const base = `/api/workspaces/${businessId}/members/${membershipId}`;

  const changeRole = async (nextRoleId: string) => {
    const role = roles.find((option) => option.id === nextRoleId)?.name ?? "";
    const answer = await ask({
      title: tConfirm("changeRole.title", { name: memberName, role }),
      body: tConfirm("changeRole.body"),
      confirmLabel: tConfirm("changeRole.confirm"),
    });
    if (!answer.confirmed) return;
    setSelected(nextRoleId);
    run(() => api.patch(base, { roleId: nextRoleId }));
  };

  const remove = async () => {
    const answer = await ask({
      title: tConfirm("removeMember.title", { name: memberName }),
      body: tConfirm("removeMember.body"),
      confirmLabel: tConfirm("removeMember.confirm"),
      danger: true,
    });
    if (answer.confirmed) run(() => api.delete(base));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirmDialog}
      <select
        aria-label={t("role")}
        value={selected}
        disabled={pending}
        onChange={(event) => void changeRole(event.target.value)}
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
        onClick={() => void remove()}
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
      <FormError message={error} className="sm:col-span-3" />
    </form>
  );
}
