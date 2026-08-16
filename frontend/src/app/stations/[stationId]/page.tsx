import Link from "next/link";
import { ArrowLeft, BatteryCharging, Info, LayoutGrid, Plug } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Panel } from "@/components/ui/Panel";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { StatCard } from "@/components/ui/StatCard";
import { StatusDot } from "@/components/ui/StatusDot";
import { HealthBar } from "@/components/ui/HealthBar";
import { getStationDetail } from "@/lib/api/resources";

/** The service sends `last_seen: null` for chargers that have never reported;
 * without this guard `new Date(null)` renders as 1 Jan 1970. */
function formatLastSeen(value: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() === 0) return "Never";
  return parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function StationDetailPage({
  params,
}: {
  params: Promise<{ stationId: string }>;
}) {
  const { stationId } = await params;
  const { data, error } = await getStationDetail(stationId);

  if (error || !data) {
    return (
      <PageShell title={stationId} subtitle="Station detail">
        <ApiErrorState title={`Could not load ${stationId}`} error={error ?? "Unknown error"} />
      </PageShell>
    );
  }

  const { station, chargers } = data;
  const faulty = chargers.filter((c) => c.faulty).length;

  return (
    <PageShell title={station.stationId} subtitle={station.name}>
      <div className="flex flex-col gap-4">
        <Link
          href="/stations"
          className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-[var(--series-1)] hover:underline"
        >
          <ArrowLeft size={14} />
          All stations
        </Link>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={LayoutGrid}
            iconBg="color-mix(in srgb, var(--series-7) 12%, transparent)"
            iconColor="var(--series-7)"
            label="Docks"
            value={station.dockCount}
            breakdown={[
              { label: "Healthy", value: station.healthyDocks, tone: "good" },
              { label: "At risk", value: station.atRiskDocks, tone: "warning" },
              { label: "Critical", value: station.criticalDocks, tone: "critical" },
            ]}
          />
          <StatCard
            icon={Plug}
            iconBg="color-mix(in srgb, var(--series-1) 12%, transparent)"
            iconColor="var(--series-1)"
            label="Chargers"
            value={station.chargersOnline + station.chargersOffline}
            breakdown={[
              { label: "Online", value: station.chargersOnline, tone: "good" },
              { label: "Offline", value: station.chargersOffline, tone: "critical" },
              { label: "Faulty", value: faulty, tone: "warning" },
            ]}
          />
          <StatCard
            icon={BatteryCharging}
            iconBg="color-mix(in srgb, var(--status-critical) 12%, transparent)"
            iconColor="var(--status-critical)"
            label="High Risk Docks"
            value={station.highRiskDocks}
          />
          <Panel>
            <div className="text-[12px] text-text-muted">Station Status</div>
            <div className="mt-1">
              <StatusDot status={station.online ? "ONLINE" : "OFFLINE"} />
            </div>
            <div className="mt-4 text-[12px] text-text-muted">Average Dock Health</div>
            <div className="mt-1">
              <HealthBar score={station.avgHealthScore} />
            </div>
          </Panel>
        </div>

        <Panel title="Chargers" titleNote={`(${chargers.length})`}>
          {chargers.length === 0 ? (
            <p className="text-[13px] text-text-muted">No chargers reported for this station.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-text-muted">
                    <th className="pb-2 pr-3 font-medium">Charger</th>
                    <th className="pb-2 pr-3 font-medium">Dock</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 pr-3 font-medium">Faulty</th>
                    <th className="pb-2 font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {chargers.map((charger) => (
                    <tr key={charger.chargerId} className="hover:bg-[var(--surface-2)]">
                      <td className="py-2.5 pr-3 text-[13px] font-medium text-text-primary">
                        {charger.chargerId}
                      </td>
                      <td className="py-2.5 pr-3 text-[13px] text-text-secondary">{charger.dockId}</td>
                      <td className="py-2.5 pr-3">
                        <StatusDot status={charger.online ? "ONLINE" : "OFFLINE"} />
                      </td>
                      <td className="py-2.5 pr-3 text-[13px]">
                        {charger.faulty ? (
                          <span className="font-medium text-[var(--status-critical)]">Yes</span>
                        ) : (
                          <span className="text-text-muted">No</span>
                        )}
                      </td>
                      <td className="py-2.5 text-[13px] tabular-nums text-text-secondary">
                        {formatLastSeen(charger.lastSeen)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Batteries cannot be listed per station until they carry a station_id. */}
        <Panel>
          <div className="flex items-start gap-2.5 text-[13px] text-text-secondary">
            <Info size={16} className="mt-0.5 flex-none text-[var(--series-1)]" />
            <span>
              <span className="font-semibold text-text-primary">
                Batteries at this station are not listed.
              </span>{" "}
              Battery records carry no <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">station_id</code>,
              so they cannot be filtered by station yet. Adding that field (or a{" "}
              <code className="rounded bg-[var(--surface-2)] px-1 py-0.5">GET /stations/{"{id}"}/batteries</code>{" "}
              endpoint) is all that is needed to populate this panel.
            </span>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
