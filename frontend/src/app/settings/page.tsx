import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { DemoControls } from "@/components/demo/DemoControls";
import { getDemoContext } from "@/lib/api/resources";
import { fetchCommandCenter } from "@/lib/api/client";
import { HEALTH_BANDS, HEALTH_WEIGHTS, RISK_BANDS } from "@/lib/mock";

const DIMENSION_LABELS: Record<keyof typeof HEALTH_WEIGHTS, string> = {
  temperature: "Temperature health",
  charging: "Charging performance",
  electrical: "Electrical behaviour",
  connectivity: "Connectivity",
  operational: "Operational performance",
};

export default async function SettingsPage() {
  const { data: demo, error: demoError } = await getDemoContext();
  // Cached per render, so this is free — the header already fetched it.
  const fleet = await fetchCommandCenter().catch(() => null);

  return (
    <PageShell title="Settings" subtitle="Scoring configuration and demo environment">
      <div className="flex flex-col gap-4">
        {/* Demo data control — spec section 14. */}
        <h2 className="text-[15px] font-semibold text-text-primary">Demo Data Control</h2>
        {demo && !demoError ? (
          <DemoControls
            datasets={demo.datasets}
            scenarios={demo.scenarios}
            assets={demo.assets}
            currentDataset={null}
          />
        ) : (
          <Panel>
            <p className="text-[13px] text-text-muted">
              Demo controls need the live service — {demoError ?? "unavailable"}.
            </p>
          </Panel>
        )}

        <h2 className="mt-2 text-[15px] font-semibold text-text-primary">Scoring Configuration</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Health Score Weights">
          <ul className="space-y-3">
            {(Object.keys(HEALTH_WEIGHTS) as (keyof typeof HEALTH_WEIGHTS)[]).map((key) => (
              <li key={key} className="flex items-center gap-3 text-[13px]">
                <span className="w-44 flex-none text-text-secondary">{DIMENSION_LABELS[key]}</span>
                <div className="h-2 flex-1 rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-2 rounded-full bg-[var(--series-1)]"
                    style={{ width: `${HEALTH_WEIGHTS[key] * 100 * 2.5}%` }}
                  />
                </div>
                <span className="w-12 flex-none text-right font-semibold tabular-nums text-text-primary">
                  {Math.round(HEALTH_WEIGHTS[key] * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-text-muted">
            Reference values only — the platform does its own scoring and does not expose its weights over the
            API, so these are the dashboard&apos;s documented defaults rather than the live configuration.
          </p>
        </Panel>

        <Panel title="Health Classification Bands">
          <ul className="space-y-2">
            {HEALTH_BANDS.map((band, idx) => {
              const upper = idx === 0 ? 100 : HEALTH_BANDS[idx - 1].min;
              const color =
                band.label === "Healthy"
                  ? "var(--status-good)"
                  : band.label === "Warning"
                    ? "var(--status-warning)"
                    : "var(--status-critical)";
              return (
                <li
                  key={band.label}
                  className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-4 py-2.5 text-[13px]"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-medium text-text-primary">{band.label}</span>
                  </span>
                  <span className="tabular-nums text-text-secondary">
                    {band.min} – {upper}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Predictive Risk Bands">
          <ul className="space-y-2">
            {[...RISK_BANDS].reverse().map((band, idx, arr) => {
              const upper = idx === arr.length - 1 ? 100 : arr[idx + 1].min - 1;
              const color =
                band.label === "Low"
                  ? "var(--status-good)"
                  : band.label === "Moderate"
                    ? "var(--status-warning)"
                    : band.label === "High"
                      ? "var(--status-serious)"
                      : "var(--status-critical)";
              return (
                <li
                  key={band.label}
                  className="flex items-center justify-between rounded-lg bg-[var(--surface-2)] px-4 py-2.5 text-[13px]"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-medium text-text-primary">{band.label}</span>
                  </span>
                  <span className="tabular-nums text-text-secondary">
                    {band.min}% – {upper}%
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Live Environment">
          <dl className="space-y-3 text-[13px]">
            {[
              ["Data source", fleet ? "Live platform API" : "Unavailable"],
              ["Stations", fleet ? String(fleet.stations.total) : "—"],
              ["Chargers", fleet ? String(fleet.chargers.total) : "—"],
              ["Batteries", fleet ? String(fleet.batteries.total) : "—"],
              ["Overall health", fleet ? `${fleet.batteries.overall_health_score}/100` : "—"],
              ["Auto refresh", "30 seconds"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2 last:border-0">
                <dt className="text-text-muted">{label}</dt>
                <dd className="font-medium tabular-nums text-text-primary">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[12px] text-text-muted">
            All figures on this dashboard come from the platform API. The synthetic generator remains only as
            a fallback for when the service is unreachable.
          </p>
        </Panel>
        </div>
      </div>
    </PageShell>
  );
}
