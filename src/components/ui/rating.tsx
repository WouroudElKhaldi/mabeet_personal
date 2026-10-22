import { clsx } from "clsx";

/** "4.92 (31)", or the "New" label when nobody has reviewed yet. `compact` hides the count, as on cards. */
export function Rating({
  average,
  count,
  label,
  compact = false,
}: {
  average: number;
  count: number;
  label: string;
  compact?: boolean;
}) {
  if (count === 0) return <span className="shrink-0 text-[0.9375rem] font-semibold">{label}</span>;
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-baseline gap-1 text-[0.9375rem] tabular-nums",
        !compact && "font-semibold",
      )}
      title={`${average.toFixed(2)} / 5`}
    >
      {average.toFixed(2)}
      <span className="sr-only">/ 5</span>
      {!compact && <span className="font-normal text-muted">({count})</span>}
    </span>
  );
}
