import Link from "next/link";
import { AlertTriangle, ChevronRight, LineChart, Wrench } from "lucide-react";

/**
 * "Maintenance Due" only renders when the service reports it — passing null
 * hides that row rather than showing a misleading zero. Every row links to the
 * screen that lists the assets behind the figure.
 */
export function RiskSummaryPanel({
  highRisk,
  maintenanceDue,
  maintenanceDueNote,
  predictedFailures,
  total,
}: {
  highRisk: number;
  maintenanceDue: number | null;
  /** The service explains when a figure is an approximation; surfaced as a
   * tooltip rather than dropped, so the number is never over-trusted. */
  maintenanceDueNote?: string | null;
  predictedFailures: number;
  total: number;
}) {
  const rows = [
    {
      key: "high",
      icon: AlertTriangle,
      label: "High Risk Assets",
      value: highRisk,
      href: "/ai-predictions",
      note: null as string | null | undefined,
      color: "var(--status-critical)",
      bg: "var(--status-critical-bg)",
    },
    ...(maintenanceDue !== null
      ? [
          {
            key: "maintenance",
            icon: Wrench,
            label: "Maintenance Due",
            value: maintenanceDue,
            href: "/ai-predictions",
            note: maintenanceDueNote,
            color: "var(--status-warning)",
            bg: "var(--status-warning-bg)",
          },
        ]
      : []),
    {
      key: "predicted",
      icon: LineChart,
      label: "Predicted Failures",
      value: predictedFailures,
      href: "/ai-predictions",
      note: null as string | null | undefined,
      color: "var(--series-7)",
      bg: "color-mix(in srgb, var(--series-7) 14%, transparent)",
    },
  ];

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const Icon = row.icon;
        const pct = total > 0 ? Math.round((row.value / total) * 1000) / 10 : 0;
        return (
          <li key={row.key}>
            <Link
              href={row.href}
              title={row.note ?? undefined}
              className="flex items-center justify-between gap-3 rounded-lg bg-[var(--surface-2)] px-3 py-2.5 transition-colors hover:bg-[var(--surface-0)]"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-lg"
                  style={{ backgroundColor: row.bg }}
                >
                  <Icon size={16} style={{ color: row.color }} />
                </span>
                <span>
                  <span className="block text-[12px] font-medium text-text-secondary">{row.label}</span>
                  <span className="block text-[20px] font-semibold leading-tight tabular-nums text-text-primary">
                    {row.value.toLocaleString()}
                  </span>
                </span>
              </span>
              <span className="flex flex-none items-center gap-1">
                <span className="text-[11.5px] font-medium tabular-nums" style={{ color: row.color }}>
                  {pct}% of total
                </span>
                <ChevronRight size={14} className="text-text-muted" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
