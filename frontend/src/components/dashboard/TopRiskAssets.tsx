import Link from "next/link";
import { BatteryCharging, ChevronRight, Plug, Warehouse } from "lucide-react";

export type AssetKind = "battery" | "charger" | "station";

export interface RankedAsset {
  id: string;
  kind: AssetKind;
  href: string;
  issue: string;
  location: string;
  risk: number;
  tag: string;
}

const KIND_STYLE: Record<AssetKind, { icon: typeof Plug; label: string; color: string; bg: string }> = {
  battery: {
    icon: BatteryCharging,
    label: "Battery",
    color: "var(--status-good)",
    bg: "color-mix(in srgb, var(--status-good) 12%, transparent)",
  },
  charger: {
    icon: Plug,
    label: "Charger",
    color: "var(--series-1)",
    bg: "color-mix(in srgb, var(--series-1) 12%, transparent)",
  },
  station: {
    icon: Warehouse,
    label: "Station",
    color: "var(--series-7)",
    bg: "color-mix(in srgb, var(--series-7) 12%, transparent)",
  },
};

function riskColor(risk: number): string {
  if (risk >= 81) return "var(--status-critical)";
  if (risk >= 61) return "var(--status-serious)";
  if (risk >= 31) return "var(--status-warning)";
  return "var(--status-good)";
}

/**
 * One ranked list across every asset type — batteries, chargers and stations
 * compete on the same 0-100 risk scale, so the operator sees what to act on
 * first without checking three separate screens.
 */
export function TopRiskAssets({ assets, limit = 6 }: { assets: RankedAsset[]; limit?: number }) {
  const ranked = [...assets].sort((a, b) => b.risk - a.risk).slice(0, limit);

  if (ranked.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-text-muted">
        Nothing above the Low risk band — all assets are clear.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {ranked.map((asset, index) => {
        const style = KIND_STYLE[asset.kind];
        const Icon = style.icon;
        const tone = riskColor(asset.risk);
        return (
          <li key={`${asset.kind}-${asset.id}`}>
            <Link
              href={asset.href}
              className="group flex items-center gap-3 rounded-lg border border-[var(--border-hairline)] px-3 py-2 transition-colors hover:border-[var(--series-1)] hover:bg-[var(--surface-2)]"
            >
              <span className="w-4 flex-none text-[11px] font-semibold tabular-nums text-text-muted">
                {index + 1}
              </span>

              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg"
                style={{ backgroundColor: style.bg }}
              >
                <Icon size={15} style={{ color: style.color }} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-text-primary">{asset.id}</span>
                  <span className="flex-none rounded px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide text-text-muted ring-1 ring-[var(--border-hairline)]">
                    {style.label}
                  </span>
                </span>
                <span className="block truncate text-[11.5px] text-text-muted" title={asset.issue}>
                  {asset.issue}
                  {asset.location ? ` · ${asset.location}` : ""}
                </span>
              </span>

              {/* Risk as a bar as well as a number, so the ranking reads at a glance. */}
              <span className="hidden w-24 flex-none sm:block">
                <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(3, Math.min(100, asset.risk))}%`, backgroundColor: tone }}
                  />
                </span>
              </span>

              <span className="flex-none text-right">
                <span className="block text-[13px] font-semibold tabular-nums" style={{ color: tone }}>
                  {Math.round(asset.risk)}%
                </span>
                <span className="block text-[10.5px] text-text-muted">{asset.tag}</span>
              </span>

              <ChevronRight
                size={15}
                className="flex-none text-text-muted transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
