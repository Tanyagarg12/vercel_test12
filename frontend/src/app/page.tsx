import { BatteryCharging, Plug, Warehouse } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { StatCard, type RiskItem } from "@/components/ui/StatCard";
import { ViewAllLink } from "@/components/ui/ViewAllLink";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { CriticalAlertBanner } from "@/components/dashboard/CriticalAlertBanner";
import { DataSourceBadge } from "@/components/dashboard/DataSourceBadge";
import { FailureReasonsPanel } from "@/components/dashboard/FailureReasonsPanel";
import { HealthDonut } from "@/components/dashboard/HealthDonut";
import { HealthTrendChart } from "@/components/dashboard/HealthTrendChart";
import { RiskSummaryPanel } from "@/components/dashboard/RiskSummaryPanel";
import { TopAtRiskTable } from "@/components/dashboard/TopAtRiskTable";
import { TopRiskAssets, type RankedAsset } from "@/components/dashboard/TopRiskAssets";
import { getDashboardData } from "@/lib/api/dashboard";

/** A station's risk as a 0-100 figure, so every card ranks on one scale. */
function stationRisk(highRisk: number, atRisk: number, docks: number): number {
  if (docks <= 0) return 0;
  return Math.min(100, Math.round(((highRisk * 2 + atRisk) / (docks * 2)) * 100));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // The header's date control writes the trend window here.
  const { days } = await searchParams;
  const trendDays = Math.min(365, Math.max(1, Number(days) || 7));
  const { data, stations, chargers } = await getDashboardData(trendDays);
  const { stations: stationCounts, chargers: chargerCounts, batteries } = data;

  // Each card ranks its own assets and shows only the top few, so the layout
  // holds whether the fleet has three assets or three thousand — what changes
  // is which ones surface.
  const stationItems: RiskItem[] = stations.map((station) => ({
    id: station.stationId,
    href: `/stations/${station.stationId}`,
    detail: station.online
      ? `${station.highRiskDocks} high-risk of ${station.dockCount} docks · health ${station.avgHealthScore}`
      : "Station offline",
    risk: station.online
      ? stationRisk(station.highRiskDocks, station.atRiskDocks, station.dockCount)
      : 100,
    tag: station.online ? undefined : "Offline",
  }));

  const chargerItems: RiskItem[] = chargers
    .filter((charger) => charger.faulty || !charger.online)
    .map((charger) => ({
      id: charger.chargerId,
      href: `/stations/${charger.stationId}`,
      detail: `${charger.dockId} · ${charger.stationId}`,
      risk: charger.faulty ? 90 : 60,
      tag: charger.faulty ? "Faulty" : "Offline",
    }));

  // One ranked list across every asset type, so the operator sees what to act
  // on first without visiting three screens.
  const topRiskAssets: RankedAsset[] = [
    ...data.atRisk.map((row) => ({
      id: row.batteryId,
      kind: "battery" as const,
      href: `/batteries/${row.batteryId}`,
      issue: row.likelyIssue,
      location: row.stationId ?? "",
      risk: row.riskScore,
      tag: row.priority,
    })),
    ...chargers
      .filter((charger) => charger.faulty || !charger.online)
      .map((charger) => ({
        id: charger.chargerId,
        kind: "charger" as const,
        href: `/stations/${charger.stationId}`,
        issue: charger.faulty ? "Charger fault reported" : "Charger not reporting",
        location: `${charger.dockId} · ${charger.stationId}`,
        risk: charger.faulty ? 90 : 60,
        tag: charger.faulty ? "Faulty" : "Offline",
      })),
    ...stations
      .filter((station) => !station.online || station.highRiskDocks > 0)
      .map((station) => ({
        id: station.stationId,
        kind: "station" as const,
        href: `/stations/${station.stationId}`,
        issue: station.online
          ? `${station.highRiskDocks} high-risk docks of ${station.dockCount}`
          : "Station offline",
        location: `avg health ${station.avgHealthScore}`,
        risk: station.online
          ? stationRisk(station.highRiskDocks, station.atRiskDocks, station.dockCount)
          : 100,
        tag: station.online ? "At risk" : "Offline",
      })),
  ];

  const batteryItems: RiskItem[] = data.atRisk.map((row) => ({
    id: row.batteryId,
    href: `/batteries/${row.batteryId}`,
    detail: row.likelyIssue,
    risk: row.riskScore,
    tag: row.priority,
  }));

  return (
    <PageShell title="Asset Intelligence Platform" subtitle="Overview of Stations, Chargers & Batteries">
      <div className="flex flex-col gap-3">
        <DataSourceBadge source={data.source} />
        <CriticalAlertBanner rows={data.atRisk} />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={Warehouse}
            iconBg="color-mix(in srgb, var(--series-7) 12%, transparent)"
            iconColor="var(--series-7)"
            label="Stations"
            value={stationCounts.total}
            href="/stations"
            breakdown={[
              { label: "Online", value: stationCounts.online, tone: "good" },
              { label: "Offline", value: stationCounts.offline, tone: "critical" },
            ]}
            items={stationItems}
            emptyMessage="All stations healthy."
          />
          <StatCard
            icon={Plug}
            iconBg="color-mix(in srgb, var(--series-1) 12%, transparent)"
            iconColor="var(--series-1)"
            label="Chargers"
            value={chargerCounts.total}
            href="/chargers"
            // Faulty chargers are counted inside online/offline upstream, so the
            // three figures sit alongside each other rather than summing.
            breakdown={[
              { label: "Online", value: chargerCounts.online, tone: "good" },
              { label: "Offline", value: chargerCounts.offline, tone: "critical" },
              { label: "Faulty", value: chargerCounts.faulty, tone: "warning" },
            ]}
            items={chargerItems}
            emptyMessage="No faulty or offline chargers."
          />
          <StatCard
            icon={BatteryCharging}
            iconBg="color-mix(in srgb, var(--status-good) 12%, transparent)"
            iconColor="var(--status-good)"
            label="Batteries"
            value={batteries.total}
            href="/batteries"
            breakdown={[
              { label: "Health", value: `${batteries.overallHealth}/100`, tone: "good" },
              { label: "High risk", value: batteries.highRisk, tone: "warning" },
              { label: "Predicted", value: batteries.predictedFailures, tone: "critical" },
            ]}
            items={batteryItems}
            emptyMessage="No battery above the Low risk band."
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Panel
            title="Top Risk Assets"
            titleNote="(all asset types)"
            className="lg:col-span-7"
            action={<ViewAllLink href="/ai-predictions" />}
          >
            <TopRiskAssets assets={topRiskAssets} limit={6} />
          </Panel>

          <Panel title="Top Critical Alerts" className="lg:col-span-5" action={<ViewAllLink href="/alerts" />}>
            <AlertsPanel alerts={data.alerts} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Panel title="Asset Health Distribution" titleNote="(all assets)">
            <HealthDonut buckets={data.healthBuckets} total={data.distributionTotal} />
          </Panel>

          <Panel
            title="AI Risk Summary"
            titleNote="(Next 24 Hrs)"
            footer={
              <div className="flex justify-center">
                <ViewAllLink href="/ai-predictions" label="View All Predictions" />
              </div>
            }
          >
            <RiskSummaryPanel
              highRisk={batteries.highRisk}
              maintenanceDue={batteries.maintenanceDue}
              maintenanceDueNote={data.riskNotes.maintenanceDue}
              predictedFailures={batteries.predictedFailures}
              total={batteries.total}
            />
          </Panel>

          <Panel
            title="Top Failure Reasons"
            titleNote="(Next 24 Hrs)"
          >
            <FailureReasonsPanel reasons={data.failureReasons} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {/* Hidden until the service exposes a health-trend series. */}
          {data.healthTrend && (
            <Panel
              title="Battery Health Trend"
              className="lg:col-span-5"
              action={
                <span className="rounded-lg border border-[var(--border-hairline)] px-2.5 py-1 text-[12px] text-text-secondary">
                  Last {data.healthTrend.length} Days
                </span>
              }
            >
              <HealthTrendChart data={data.healthTrend} />
            </Panel>
          )}

          <Panel
            title="Top At Risk Batteries"
            titleNote="(Next 24 Hrs)"
            className={data.healthTrend ? "lg:col-span-7" : "lg:col-span-12"}
            action={<ViewAllLink href="/ai-predictions" />}
          >
            <TopAtRiskTable rows={data.atRisk} />
          </Panel>

        </div>
      </div>
    </PageShell>
  );
}
