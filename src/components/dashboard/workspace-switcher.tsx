"use client";

import { ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Workspace {
  id: string;
  name: string;
  role: string;
}

export function WorkspaceSwitcher({ current, workspaces }: { current: string; workspaces: Workspace[] }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const active = workspaces.find((workspace) => workspace.id === current);
  return (
    <label className="relative block rounded-lg bg-surface px-3 py-2.5 ring-1 ring-line transition-shadow focus-within:ring-2 focus-within:ring-accent">
      <span className="block truncate font-display text-[1.05rem] font-semibold">{active?.name}</span>
      <span className="block text-xs text-muted">{active?.role}</span>
      <ChevronsUpDown className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <select
        aria-label={t("switchWorkspace")}
        value={current}
        onChange={(event) =>
          router.push(event.target.value === "new" ? "/host" : `/dashboard/${event.target.value}`)
        }
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
        <option value="new">+ {t("newWorkspace")}</option>
      </select>
    </label>
  );
}
