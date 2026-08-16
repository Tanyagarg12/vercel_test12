"use client";

import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Bucket, HealthState } from "@/lib/api/normalise";

/** The API reports five condition states; each keeps its own colour so the
 * donut, the legend and the KPI cards all agree. */
const COLORS: Record<HealthState, string> = {
  healthy: "var(--status-good)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
  offline: "var(--text-muted)",
};

const RANGE: Record<HealthState, string> = {
  healthy: "70-100",
  warning: "40-70",
  critical: "0-40",
  offline: "no signal",
};

export function HealthDonut({ buckets, total }: { buckets: Bucket[]; total: number }) {
  // Recharts renders nothing for an all-zero dataset, so show the states with
  // data and fall back to a message when the fleet reports nothing at all.
  const shown = buckets.filter((bucket) => bucket.count > 0);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-[168px] w-[168px] flex-none">
        {shown.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={shown}
                dataKey="count"
                nameKey="label"
                innerRadius="64%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                paddingAngle={shown.length > 1 ? 1.5 : 0}
                stroke="var(--surface-1)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {shown.map((bucket) => (
                  <Cell key={bucket.state} fill={COLORS[bucket.state]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--text-primary)",
                }}
                formatter={(value, name) => [`${Number(value).toLocaleString()} batteries`, String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full border-[18px] border-[var(--surface-2)]" />
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-semibold leading-tight tabular-nums text-text-primary">
            {total.toLocaleString()}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-text-muted">Total Assets</span>
        </div>
      </div>

      <ul className="min-w-[150px] flex-1 space-y-0.5">
        {buckets.map((bucket) => {
          // Batteries carry no offline flag, so that band cannot be filtered on
          // — it links to the unfiltered list rather than an empty result.
          const href =
            bucket.state === "offline"
              ? "/batteries"
              : `/batteries?condition=${bucket.state.toUpperCase()}`;
          return (
          <li key={bucket.state}>
            <Link
              href={href}
              className="-mx-1.5 flex items-baseline justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--surface-2)]"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] leading-tight">
                <span
                  className="h-2.5 w-2.5 flex-none rounded-full"
                  style={{ backgroundColor: COLORS[bucket.state] }}
                />
                <span className="truncate text-text-secondary">
                  {bucket.label}
                  <span className="text-text-muted"> ({RANGE[bucket.state]})</span>
                </span>
              </span>
              <span className="flex-none text-[12.5px] font-semibold tabular-nums text-text-primary">
                {bucket.count.toLocaleString()}
                <span className="ml-1 font-normal text-text-muted">{bucket.pct}%</span>
              </span>
            </Link>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
