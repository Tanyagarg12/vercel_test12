import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, type LucideIcon } from "lucide-react";

export interface StatBreakdown {
  label: string;
  value: number | string;
  pct?: number;
  tone: "good" | "warning" | "critical";
}

/** An individual asset listed under a stat, ranked by how much attention it needs. */
export interface RiskItem {
  id: string;
  href: string;
  /** Secondary line — the issue, station, or whatever identifies it. */
  detail: string;
  /** 0-100. Drives both the ordering and the colour. */
  risk: number;
  /** Short right-hand tag: priority, status, etc. */
  tag?: string;
}

const TONE_TEXT = {
  good: "text-[var(--status-good)]",
  warning: "text-[var(--status-warning)]",
  critical: "text-[var(--status-critical)]",
};

function formatNumber(value: number | string): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : value;
}

function riskColor(risk: number): string {
  if (risk >= 81) return "var(--status-critical)";
  if (risk >= 61) return "var(--status-serious)";
  if (risk >= 31) return "var(--status-warning)";
  return "var(--status-good)";
}

/**
 * A headline count with an optional list of the individual assets behind it.
 *
 * The list is always sorted by risk and capped, so the card stays the same size
 * whether the fleet has three assets or three thousand — what changes is which
 * ones surface. Every row links to that asset.
 */
export function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  href,
  breakdown,
  items = [],
  itemLimit = 3,
  emptyMessage = "Nothing needs attention.",
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  /** Makes the headline and "All" affordance navigate to the full list. */
  href?: string;
  breakdown?: StatBreakdown[];
  items?: RiskItem[];
  itemLimit?: number;
  emptyMessage?: string;
}) {
  const ranked = [...items].sort((a, b) => b.risk - a.risk).slice(0, itemLimit);
  const showList = items.length > 0 || Boolean(emptyMessage && href);

  const heading = (
    <span className="flex items-center gap-2.5">
      <span
        className="flex h-10 w-10 flex-none items-center justify-center rounded-xl transition-transform group-hover:scale-105"
        style={{ backgroundColor: iconBg }}
      >
        <Icon size={19} strokeWidth={2} style={{ color: iconColor }} />
      </span>
      <span>
        <span className="block text-[12px] font-medium text-text-secondary">{label}</span>
        <span className="block text-[25px] font-semibold leading-tight tracking-tight text-text-primary">
          {formatNumber(value)}
        </span>
      </span>
    </span>
  );

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] p-4 transition-shadow hover:shadow-md hover:shadow-black/5">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${iconColor}, color-mix(in srgb, ${iconColor} 25%, transparent))` }}
      />
      <div className="flex items-start justify-between gap-2">
        {href ? (
          <Link href={href} className="rounded hover:opacity-80">
            {heading}
          </Link>
        ) : (
          heading
        )}
        {href && (
          <Link
            href={href}
            className="flex flex-none items-center gap-1 text-[11.5px] font-medium text-[var(--series-1)] hover:underline"
          >
            All
            <ArrowRight size={11} />
          </Link>
        )}
      </div>

      {breakdown && breakdown.length > 0 && (
        <div className="mt-3 grid auto-cols-fr grid-flow-col items-start gap-2 border-t border-[var(--border-hairline)] pt-2.5">
          {breakdown.map((item, idx) => (
            <div key={item.label} className={clsx("min-w-0", idx > 0 && "border-l border-[var(--border-hairline)] pl-2")}>
              <div className={clsx("truncate text-[11.5px] font-medium", TONE_TEXT[item.tone])}>
                {item.label}
              </div>
              <div className="truncate text-[12.5px] font-semibold tabular-nums text-text-primary">
                {formatNumber(item.value)}
                {item.pct !== undefined && (
                  <span className="ml-1 font-normal text-text-muted">({Math.round(item.pct)}%)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showList && (
        <div className="mt-2.5 flex-1 border-t border-[var(--border-hairline)] pt-1">
          {ranked.length === 0 ? (
            <p className="pt-1.5 text-[11.5px] text-text-muted">{emptyMessage}</p>
          ) : (
            <ul className="divide-y divide-[var(--border-hairline)]">
              {ranked.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="-mx-1 flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-[var(--surface-2)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-[var(--series-1)]">
                        {item.id}
                      </span>
                      <span className="block truncate text-[10.5px] text-text-muted" title={item.detail}>
                        {item.detail}
                      </span>
                    </span>
                    <span className="flex-none text-right">
                      <span
                        className="block text-[12px] font-semibold tabular-nums"
                        style={{ color: riskColor(item.risk) }}
                      >
                        {Math.round(item.risk)}%
                      </span>
                      {item.tag && <span className="block text-[10.5px] text-text-muted">{item.tag}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
