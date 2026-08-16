"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { HealthBar } from "@/components/ui/HealthBar";
import { StatusDot } from "@/components/ui/StatusDot";
import type { StationRow } from "@/lib/api/normalise";

export function StationsTable({ rows }: { rows: StationRow[] }) {
  const columns: Column<StationRow>[] = [
    {
      key: "stationId",
      header: "Station ID",
      sortValue: (r) => r.stationId,
      render: (r) => (
        <Link
          href={`/stations/${r.stationId}`}
          className="font-medium text-[var(--series-1)] hover:underline"
        >
          {r.stationId}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => (r.online ? 1 : 0),
      render: (r) => <StatusDot status={r.online ? "ONLINE" : "OFFLINE"} />,
    },
    {
      key: "docks",
      header: "Docks",
      align: "right",
      sortValue: (r) => r.dockCount,
      render: (r) => <span className="tabular-nums">{r.dockCount}</span>,
    },
    {
      key: "chargers",
      header: "Chargers",
      align: "right",
      sortValue: (r) => r.chargersOnline,
      render: (r) => (
        <span className="tabular-nums">
          <span className="text-[var(--status-good)]">{r.chargersOnline}</span>
          <span className="text-text-muted"> / </span>
          <span className="text-[var(--status-critical)]">{r.chargersOffline}</span>
        </span>
      ),
    },
    {
      key: "healthyDocks",
      header: "Healthy",
      align: "right",
      sortValue: (r) => r.healthyDocks,
      render: (r) => <span className="tabular-nums">{r.healthyDocks}</span>,
    },
    {
      key: "atRiskDocks",
      header: "At Risk",
      align: "right",
      sortValue: (r) => r.atRiskDocks,
      render: (r) =>
        r.atRiskDocks > 0 ? (
          <span className="font-semibold tabular-nums text-[var(--status-warning)]">{r.atRiskDocks}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "highRiskDocks",
      header: "High Risk",
      align: "right",
      sortValue: (r) => r.highRiskDocks,
      render: (r) =>
        r.highRiskDocks > 0 ? (
          <span className="font-semibold tabular-nums text-[var(--status-critical)]">
            {r.highRiskDocks}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: "health",
      header: "Avg Health",
      sortValue: (r) => r.avgHealthScore,
      render: (r) => <HealthBar score={r.avgHealthScore} />,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.stationId}
      rowHref={(r) => `/stations/${r.stationId}`}
      searchFields={(r) => [r.stationId, r.name]}
      searchPlaceholder="Search station…"
      filters={{
        options: [
          { value: "online", label: "Online", count: rows.filter((r) => r.online).length },
          { value: "offline", label: "Offline", count: rows.filter((r) => !r.online).length },
        ],
        predicate: (r, value) => (value === "online" ? r.online : !r.online),
      }}
      initialSort={{ key: "highRiskDocks", direction: "desc" }}
    />
  );
}
