import { CloudOff } from "lucide-react";
import type { DataSource } from "@/lib/api/normalise";

/**
 * Only renders when the dashboard has fallen back to the local synthetic
 * dataset. In normal operation it shows nothing — a "live" badge on every load
 * is noise — but demo figures must never be mistaken for real ones, especially
 * on a deployed environment where a missing API_BASE_URL is invisible
 * otherwise.
 */
export function DataSourceBadge({ source }: { source: DataSource }) {
  if (source === "api") return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2 text-[12.5px]"
      style={{
        backgroundColor: "var(--status-warning-bg)",
        borderColor: "color-mix(in srgb, var(--status-warning) 30%, transparent)",
      }}
    >
      <CloudOff size={15} className="flex-none text-[var(--status-warning)]" />
      <span className="font-semibold text-text-primary">Showing sample data.</span>
      <span className="text-text-secondary">
        The monitoring platform is unreachable, so these figures are simulated and must not be used
        operationally.
      </span>
    </div>
  );
}
