import { clsx } from "clsx";
import { type ComponentProps, type ReactNode, useId } from "react";

export const inputClass = clsx(
  "peer h-12 w-full rounded-md bg-surface px-4 text-[0.9375rem] text-ink ring-1 ring-line-strong",
  "placeholder:text-faint transition-shadow duration-200",
  "focus:ring-2 focus:ring-accent focus:outline-none",
  "aria-invalid:ring-danger",
);

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
