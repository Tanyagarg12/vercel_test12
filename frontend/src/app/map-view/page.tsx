import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { MAP_LEGEND, NetworkMap } from "@/components/dashboard/NetworkMap";
import { getFleet } from "@/lib/mock";

export default function MapViewPage() {
  const fleet = getFleet();

  const atRiskByStation = new Map<string, number>();
  fleet.batteries.forEach((b) => {
    if (b.risk.category === "High" || b.risk.category === "Critical") {
      atRiskByStation.set(b.stationId, (atRiskByStation.get(b.stationId) ?? 0) + 1);
    }
  });

  const hotspots = [...atRiskByStation.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([stationId, count]) => ({ station: fleet.stationsById.get(stationId)!, count }));

  const byCity = new Map<string, { stations: number; atRisk: number }>();
  fleet.stations.forEach((s) => {
    const entry = byCity.get(s.city) ?? { stations: 0, atRisk: 0 };
    entry.stations += 1;
    entry.atRisk += atRiskByStation.get(s.stationId) ?? 0;
    byCity.set(s.city, entry);
  });

  return (
    <PageShell title="Map View" subtitle="Geographic distribution of stations and risk concentration">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Station Network" className="self-start lg:col-span-2">
          <NetworkMap stations={fleet.stations} atRiskByStation={atRiskByStation} />
          <div className="mt-4 flex flex-wrap gap-4">
            {MAP_LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5 text-[12px] text-text-secondary">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-text-muted">
            Markers are plotted from station coordinates — click a marker to open that station.
          </p>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Risk Hotspots">
            <ul className="-my-1 divide-y divide-[var(--border-hairline)]">
              {hotspots.map(({ station, count }) => (
                <li key={station.stationId}>
                  <Link
                    href={`/stations/${station.stationId}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-[var(--surface-2)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-text-primary">
                        {station.stationId}
                      </span>
                      <span className="block truncate text-[12px] text-text-muted">{station.name}</span>
                    </span>
                    <span
                      className="flex-none whitespace-nowrap rounded-md px-2 py-1 text-[12px] font-semibold tabular-nums"
                      style={{
                        backgroundColor: count >= 3 ? "var(--status-critical-bg)" : "var(--status-warning-bg)",
                        color: count >= 3 ? "var(--status-critical)" : "var(--status-warning)",
                      }}
                    >
                      {count} at risk
                    </span>
                  </Link>
                </li>
              ))}
              {hotspots.length === 0 && <p className="py-4 text-[13px] text-text-muted">No hotspots.</p>}
            </ul>
          </Panel>

          <Panel title="By City">
            <ul className="-my-1 divide-y divide-[var(--border-hairline)]">
              {[...byCity.entries()]
                .sort((a, b) => b[1].atRisk - a[1].atRisk)
                .map(([city, data]) => (
                  <li key={city} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <span className="text-text-secondary">{city}</span>
                    <span className="tabular-nums text-text-muted">
                      {data.stations} stations ·{" "}
                      <span className="font-semibold text-[var(--status-critical)]">{data.atRisk}</span> at risk
                    </span>
                  </li>
                ))}
            </ul>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
