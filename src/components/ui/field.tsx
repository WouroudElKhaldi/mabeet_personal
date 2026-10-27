import { clsx } from "clsx";
import { type ComponentProps, type ReactNode, useId } from "react";

export const inputClass = clsx(
  "peer h-12 w-full rounded-lg bg-surface px-4 text-[0.9375rem] text-ink ring-1 ring-line-strong",
  "placeholder:text-faint transition-shadow duration-150 hover:ring-ink/40",
  "focus:ring-2 focus:ring-ink focus:outline-none",
  "aria-invalid:ring-danger",
);

/** A small caption stacked over a compact input or select, for inline forms (prices, sessions, payments). */
export const labelledControlClass = "grid gap-1 text-xs font-semibold text-muted";

/** A raised surface grouping related content or a form section. */
export const panelClass = "rounded-xl bg-surface p-5 ring-1 ring-line";

/** A label styled as a pill around a hidden checkbox or radio; it fills in when checked. */
export const choiceChipClass =
  "cursor-pointer rounded-full px-3.5 py-1.5 text-sm ring-1 ring-line has-checked:bg-accent-soft has-checked:font-semibold has-checked:ring-accent";

interface FieldProps extends ComponentProps<"input"> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function Field({ label, hint, error, className, id, ...input }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error || hint ? `${inputId}-note` : undefined;
  return (
    <div className={clsx("grid gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass}
        {...input}
      />
      {(error || hint) && (
        <p id={describedBy} className={clsx("text-sm", error ? "text-danger" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** A label around any control (a select, a custom input), with an optional hint under it. */
export function LabeledControl({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={clsx("grid gap-1 text-sm font-semibold", className)}>
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, className, ...props }: ComponentProps<"textarea"> & { label: string }) {
  const id = useId();
  return (
    <div className={clsx("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea id={id} className={clsx(inputClass, "h-auto min-h-28 py-3")} {...props} />
    </div>
  );
}
