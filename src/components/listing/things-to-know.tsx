import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface KnowItem {
  icon: LucideIcon;
  title: string;
  body: ReactNode;
}

/** Airbnb-style "Things to know": short titled blocks with an icon, three across on wide screens. */
export function ThingsToKnow({ title, items }: { title: string; items: KnowItem[] }) {
  return (
    <section className="mt-12 border-t border-line pt-12">
      <h2 className="text-[1.375rem] font-semibold">{title}</h2>
      <div className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, title: heading, body }) => (
          <div key={heading}>
            <Icon className="size-6" aria-hidden strokeWidth={1.6} />
            <h3 className="mt-3 font-semibold tracking-normal">{heading}</h3>
            <div className="mt-1 text-[0.9375rem] leading-relaxed text-muted">{body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** A plain list inside a "Things to know" block. */
export function KnowList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-1">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
