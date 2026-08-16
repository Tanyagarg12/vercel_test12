"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, BatteryCharging, Plug, Radio } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { RiskPill } from "@/components/ui/RiskPill";
import { StatCard } from "@/components/ui/StatCard";
import { generateTelemetry, getAtRiskBatteries, getFleet } from "@/lib/mock";

const TICK_MS = 3000;
const FEED_LENGTH = 14;
/** Fixed reference so the first render is byte-identical on server and client. */
const FEED_REFERENCE = Date.UTC(2026, 4, 20, 10, 0, 0);

interface FeedRow {
  key: string;
  batteryId: string;
  stationLabel: string;
  temperature: number;
  current: number;
  chargingDuration: number;
  connectivity: string;
  riskPercent: number;
  riskCategory: "Low" | "Moderate" | "High" | "Critical";
}

export function LiveMonitoringBody() {
  const fleet = getFleet();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((current) => current + 1), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // A rolling window over the watch-list, so the feed visibly advances the
  // way a live telemetry stream would without inventing new readings.
  const watchList = useMemo(() => getAtRiskBatteries(fleet).slice(0, 80), [fleet]);

  const feed: FeedRow[] = useMemo(() => {
    return Array.from({ length: FEED_LENGTH }, (_, i) => {
      const battery = watchList[(tick + i) % watchList.length];
      const series = generateTelemetry(battery, 1, FEED_REFERENCE);
      const latest = series[series.length - 1 - (tick % 4)] ?? series[series.length - 1];
      return {
        key: `${battery.batteryId}-${i}`,
        batteryId: battery.batteryId,
        stationLabel: battery.stationLabel,
        temperature: latest.temperature,
        current: latest.current,
        chargingDuration: latest.chargingDuration,
        connectivity: latest.connectivityStatus,
        riskPercent: battery.risk.percent,
        riskCategory: battery.risk.category,
      };
    });
  }, [watchList, tick]);

  const charging = Math.round(fleet.batteries.length * 0.42);
  const swapping = Math.round(fleet.batteries.length * 0.11);

  return (
    <div className="flex min-h-full flex-col">

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Radio}
            iconBg="color-mix(in srgb, var(--status-good) 12%, transparent)"
            iconColor="var(--status-good)"
            label="Reporting Now"
            value={fleet.batteries.filter((b) => b.status === "ACTIVE").length}
            breakdown={[
              { label: "No signal", value: fleet.batteries.filter((b) => b.status === "OFFLINE").length, tone: "critical" },
            ]}
          />
          <StatCard
            icon={BatteryCharging}
            iconBg="color-mix(in srgb, var(--series-1) 12%, transparent)"
            iconColor="var(--series-1)"
            label="Charging"
            value={charging}
            breakdown={[{ label: "Swapping", value: swapping, tone: "good" }]}
          />
          <StatCard
            icon={Plug}
            iconBg="var(--status-critical-bg)"
            iconColor="var(--status-critical)"
            label="Faulty Chargers"
            value={fleet.chargers.filter((c) => c.status === "FAULTY").length}
            breakdown={[
              { label: "Stations offline", value: fleet.stations.filter((s) => s.status === "OFFLINE").length, tone: "critical" },
            ]}
          />
          <StatCard
            icon={Activity}
            iconBg="var(--status-warning-bg)"
            iconColor="var(--status-warning)"
            label="On Watch List"
            value={getAtRiskBatteries(fleet).length}
            breakdown={[
              {
                label: "Critical",
                value: fleet.batteries.filter((b) => b.risk.category === "Critical").length,
                tone: "critical",
              },
            ]}
          />
        </div>

        <Panel
          title="Telemetry Stream"
          action={
            <span className="flex items-center gap-1.5 text-[12px] text-text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--status-good)]" />
              Live · every {TICK_MS / 1000}s
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-text-muted">
                  <th className="pb-2 pr-3 font-medium">Battery</th>
                  <th className="pb-2 pr-3 font-medium">Station</th>
                  <th className="pb-2 pr-3 text-right font-medium">Temp</th>
                  <th className="pb-2 pr-3 text-right font-medium">Current</th>
                  <th className="pb-2 pr-3 text-right font-medium">Charge Time</th>
                  <th className="pb-2 pr-3 font-medium">Link</th>
                  <th className="pb-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {feed.map((row) => (
                  <tr key={row.key} className="hover:bg-[var(--surface-2)]">
                    <td className="py-2.5 pr-3 text-[13px]">
                      <Link href={`/batteries/${row.batteryId}`} className="font-medium text-[var(--series-1)] hover:underline">
                        {row.batteryId}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-[13px] text-text-secondary">{row.stationLabel}</td>
                    <td className="py-2.5 pr-3 text-right text-[13px] tabular-nums text-text-secondary">
                      {row.temperature.toFixed(1)}°C
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[13px] tabular-nums text-text-secondary">
                      {row.current.toFixed(1)} A
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[13px] tabular-nums text-text-secondary">
                      {row.chargingDuration.toFixed(0)} min
                    </td>
                    <td className="py-2.5 pr-3 text-[13px]">
                      <span
                        className="font-medium"
                        style={{
                          color:
                            row.connectivity === "STABLE"
                              ? "var(--status-good)"
                              : row.connectivity === "INTERMITTENT"
                                ? "var(--status-warning)"
                                : "var(--status-critical)",
                        }}
                      >
                        {row.connectivity.charAt(0) + row.connectivity.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <RiskPill percent={row.riskPercent} category={row.riskCategory} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
