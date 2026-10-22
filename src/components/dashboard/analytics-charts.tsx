import { BarChart, ShareBar } from "./bar-chart";

// Charts drawn from the database's numbers, used both on the Analytics page and inside AI reports, so a report
// can never show a figure the database doesn't have.

const CHANNEL_COLORS = ["bg-accent", "bg-glow", "bg-ink/70", "bg-success", "bg-warning", "bg-danger"];

export interface ChartLabels {
  month: (iso: string) => string;
  money: (cents: number) => string;
  nights: (count: number) => string;
  channel: (key: string) => string;
  status: (key: string) => string;
}

export function NightsChart({
  rows,
  labels,
}: {
  rows: Array<{ month: string; nights: number }>;
  labels: ChartLabels;
}) {
  if (rows.length === 0) return null;
  return (
    <BarChart
      bars={rows.map((row) => ({
        label: labels.month(row.month),
        value: row.nights,
        title: `${labels.month(row.month)}: ${labels.nights(row.nights)}`,
      }))}
    />
  );
}

export function RevenueChart({
  rows,
  labels,
}: {
  rows: Array<{ month: string; cents: number }>;
  labels: ChartLabels;
}) {
  if (rows.length === 0) return null;
  return (
    <BarChart
      bars={rows.map((row) => ({
        label: labels.month(row.month),
        value: row.cents,
        title: `${labels.month(row.month)}: ${labels.money(row.cents)}`,
      }))}
    />
  );
}

export function ChannelsChart({
  rows,
  labels,
}: {
  rows: Array<{ channel: string; nights: number }>;
  labels: ChartLabels;
}) {
  if (rows.length === 0) return null;
  return (
    <ShareBar
      shares={rows.map((row, index) => ({
        label: `${labels.channel(row.channel)} · ${labels.nights(row.nights)}`,
        value: row.nights,
        className: CHANNEL_COLORS[index % CHANNEL_COLORS.length]!,
      }))}
    />
  );
}

export function RequestsChart({ counts, labels }: { counts: Record<string, number>; labels: ChartLabels }) {
  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  if (entries.length === 0) return null;
  return (
    <ul className="grid gap-2">
      {entries.map(([status, count]) => (
        <li key={status} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate text-muted">{labels.status(status)}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </span>
          <span className="text-end font-semibold tabular-nums">{count}</span>
        </li>
      ))}
    </ul>
  );
}
