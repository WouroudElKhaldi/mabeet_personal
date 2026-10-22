import type { ReactNode } from "react";

/** The title block every dashboard and admin page starts with. */
export function PageHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="rise-in mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <span className="mb-3 block h-1 w-10 rounded-full bg-glow" aria-hidden />
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {intro && <p className="mt-2 max-w-2xl text-muted">{intro}</p>}
      </div>
      {actions}
    </header>
  );
}

/** A titled card on a dashboard page. */
export function Panel({
  title,
  intro,
  action,
  children,
}: {
  title: string;
  intro?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface p-5 ring-1 ring-line">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{title}</h2>
          {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
