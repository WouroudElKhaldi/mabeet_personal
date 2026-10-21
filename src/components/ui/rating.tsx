import { Star } from "lucide-react";

export function Rating({ average, count, label }: { average: number; count: number; label: string }) {
  if (count === 0) return <span className="text-sm text-muted">{label}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">
      <Star aria-hidden className="size-3.5 fill-glow stroke-glow" />
      {average.toFixed(1)}
      <span className="font-normal text-muted">({count})</span>
    </span>
  );
}
