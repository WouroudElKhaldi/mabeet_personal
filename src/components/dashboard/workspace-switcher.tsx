"use client";

import { clsx } from "clsx";
import { Check, ChevronsUpDown, LayoutGrid, Plus, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

interface Workspace {
  id: string;
  name: string;
  role: string;
}

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

/** The businesses this person works in: a button showing the current one, and a searchable list to switch. */
export function WorkspaceSwitcher({ current, workspaces }: { current: string; workspaces: Workspace[] }) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const active = workspaces.find((workspace) => workspace.id === current);
  const shown = workspaces.filter((workspace) =>
    workspace.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !panel.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("switchWorkspace")}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-xl bg-paper px-3 py-2.5 text-start ring-1 ring-line transition-shadow hover:ring-line-strong focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-ink">
          {initials(active?.name ?? "") || "·"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{active?.name}</span>
          <span className="block truncate text-xs text-muted">{active?.role}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-x-0 top-full z-50 mt-2 rounded-xl bg-surface p-1.5 shadow-lift ring-1 ring-line"
          >
            {workspaces.length > 5 && (
              <label className="mb-1 flex items-center gap-2 rounded-lg bg-surface-2 px-3">
                <Search className="size-4 text-muted" aria-hidden />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("findBusiness")}
                  aria-label={t("findBusiness")}
                  className="h-9 w-full bg-transparent text-sm outline-none"
                />
              </label>
            )}
            <ul role="listbox" aria-label={t("switchWorkspace")} className="max-h-72 overflow-y-auto">
              {shown.map((workspace) => (
                <li key={workspace.id} role="option" aria-selected={workspace.id === current}>
                  <Link
                    href={`/dashboard/${workspace.id}`}
                    onClick={() => setOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-surface-2",
                      workspace.id === current && "bg-surface-2",
                    )}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent/10 text-xs font-bold text-accent">
                      {initials(workspace.name) || "·"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{workspace.name}</span>
                      <span className="block truncate text-xs text-muted">{workspace.role}</span>
                    </span>
                    {workspace.id === current && (
                      <Check className="size-4 shrink-0 text-accent" aria-hidden />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {workspaces.length > 1 && (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center gap-3 rounded-lg border-t border-line px-2.5 py-2.5 text-sm font-semibold transition-colors hover:bg-surface-2"
              >
                <LayoutGrid className="size-4 text-muted" aria-hidden />
                {t("allPlaces")}
              </Link>
            )}
            <Link
              href="/host"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-3 rounded-lg border-t border-line px-2.5 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-surface-2"
            >
              <Plus className="size-4" aria-hidden />
              {t("newWorkspace")}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
