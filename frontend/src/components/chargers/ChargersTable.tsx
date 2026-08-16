"use client";

import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusDot } from "@/components/ui/StatusDot";
import type { ChargerRow } from "@/lib/api/normalise";

/** `last_seen` is null for chargers that have never reported. */
function lastSeenLabel(value: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() === 0) return "Never";
  return parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function ChargersTable({ rows }: { rows: ChargerRow[] }) {
  const columns: Column<ChargerRow>[] = [
    {
      key: "chargerId",
      header: "Charger ID",
      sortValue: (r) => r.chargerId,
      render: (r) => <span className="font-medium text-text-primary">{r.chargerId}</span>,
    },
    { key: "dockId", header: "Dock", sortValue: (r) => r.dockId, render: (r) => r.dockId },
    {
      key: "station",
      header: "Station",
      sortValue: (r) => r.stationId,
      render: (r) => (
        <Link href={`/stations/${r.stationId}`} className="text-[var(--series-1)] hover:underline">
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
      key: "faulty",
      header: "Faulty",
      sortValue: (r) => (r.faulty ? 1 : 0),
      render: (r) =>
        r.faulty ? (
          <span className="font-semibold text-[var(--status-critical)]">Yes</span>
        ) : (
          <span className="text-text-muted">No</span>
        ),
    },
    {
      key: "lastSeen",
      header: "Last Seen",
      align: "right",
      sortValue: (r) => (r.lastSeen ? new Date(r.lastSeen).getTime() : 0),
      render: (r) => <span className="tabular-nums">{lastSeenLabel(r.lastSeen)}</span>,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.chargerId}
      searchFields={(r) => [r.chargerId, r.dockId, r.stationId]}
      searchPlaceholder="Search charger, dock or station…"
      filters={{
        options: [
          { value: "online", label: "Online", count: rows.filter((r) => r.online).length },
          { value: "offline", label: "Offline", count: rows.filter((r) => !r.online).length },
          { value: "faulty", label: "Faulty", count: rows.filter((r) => r.faulty).length },
        ],
        predicate: (r, value) =>
          value === "faulty" ? r.faulty : value === "online" ? r.online : !r.online,
      }}
      initialSort={{ key: "faulty", direction: "desc" }}
    />
  );
}
