import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import type { AtRiskRow } from "@/lib/api/normalise";

/**
 * Surfaces the single most urgent asset at the top of the dashboard and links
 * straight to it, so the highest-priority action is one click from landing.
 * Renders nothing when nothing is above the Low risk band.
 */
export function CriticalAlertBanner({ rows }: { rows: AtRiskRow[] }) {
  const worst = rows[0];
  if (!worst || worst.riskCategory === "LOW") return null;

  const critical = worst.riskCategory === "CRITICAL";
  const tone = critical ? "var(--status-critical)" : "var(--status-serious)";
  const bg = critical ? "var(--status-critical-bg)" : "var(--status-serious-bg)";
  const others = rows.filter((r) => r.riskCategory !== "LOW").length - 1;

  return (
    <Link
      href={`/batteries/${worst.batteryId}`}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl px-4 py-2.5 transition-opacity hover:opacity-90"
      style={{ backgroundColor: bg, border: `1px solid color-mix(in srgb, ${tone} 25%, transparent)` }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <TriangleAlert size={18} className="flex-none" style={{ color: tone }} />
        <span className="min-w-0 text-[13px]">
          <span className="font-semibold text-text-primary">
            {worst.batteryId} needs attention
          </span>
          <span className="text-text-secondary">
            {" "}
            — {Math.round(worst.riskScore)}% predictive risk ({worst.riskCategory.toLowerCase()}),{" "}
            {worst.likelyIssue}
            {worst.failureInHours ? `, expected within ${worst.failureInHours} hrs` : ""}
            {others > 0 ? ` · ${others} other asset${others === 1 ? "" : "s"} also flagged` : ""}
          </span>
        </span>
      </span>
      <span
        className="flex flex-none items-center gap-1.5 text-[12.5px] font-semibold"
        style={{ color: tone }}
      >
        {worst.priority} · View asset
        <ArrowRight size={13} />
      </span>
    </Link>
  );
}
