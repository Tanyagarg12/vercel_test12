import Link from "next/link";
import { AlertTriangle, TriangleAlert } from "lucide-react";
import type { AlertTone, DashboardAlert } from "@/lib/api/normalise";

const TONE_STYLE: Record<AlertTone, { color: string; bg: string }> = {
  critical: { color: "var(--status-critical)", bg: "var(--status-critical-bg)" },
  serious: { color: "var(--status-serious)", bg: "var(--status-serious-bg)" },
  warning: { color: "var(--status-warning)", bg: "var(--status-warning-bg)" },
  neutral: { color: "var(--text-muted)", bg: "var(--surface-2)" },
};

/** The API sends an ISO timestamp; render the clock time and fall back to the
 * raw string if it is not parseable. */
function clockLabel(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function severityLabel(severity: string): string {
  const s = severity.replace(/[_-]+/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  if (alerts.length === 0) {
    return <p className="text-[13px] text-text-muted">No active alerts.</p>;
  }

  return (
    <ul className="-my-1 divide-y divide-[var(--border-hairline)]">
      {alerts.map((alert) => {
        const style = TONE_STYLE[alert.tone];
        const Icon = alert.tone === "critical" ? TriangleAlert : AlertTriangle;
        const batteryId = alert.entityLabel.startsWith("Battery")
          ? alert.entityLabel.split(":").pop()?.trim()
          : null;

        // Battery alerts open that pack; everything else opens the full feed,
        // so no row is a dead end.
        const href = batteryId ? `/batteries/${batteryId}` : "/alerts";

        return (
          <li key={alert.key}>
            <Link href={href} className="-mx-1 flex items-start gap-2.5 rounded-md px-1 py-2 hover:bg-[var(--surface-2)]">
            <span
              className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full"
              style={{ backgroundColor: style.bg }}
            >
              <Icon size={14} style={{ color: style.color }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-text-primary" title={alert.title}>
                {alert.title}
              </span>
              <span className="block truncate text-[11.5px] text-text-muted">
                {alert.entityLabel}
                {alert.stationId ? ` · ${alert.stationId}` : ""}
              </span>
            </span>
            <span className="flex-none text-right">
              <span className="block text-[11.5px] text-text-muted">{clockLabel(alert.timestamp)}</span>
              <span className="block text-[11.5px] font-semibold" style={{ color: style.color }}>
                {severityLabel(alert.severity)}
              </span>
            </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
