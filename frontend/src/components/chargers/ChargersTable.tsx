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
  // Explicit column widths keep Faulty and Last Seen adjacent instead of the
  // browser spreading six sparse columns across the full panel width.
  const columns: Column<ChargerRow>[] = [
    {
      key: "chargerId",
      header: "Charger ID",
      headerClassName: "w-[20%]",
      sortValue: (r) => r.chargerId,
      render: (r) => <span className="font-medium text-text-primary">{r.chargerId}</span>,
    },
    {
      key: "dockId",
      header: "Dock",
      headerClassName: "w-[12%]",
      sortValue: (r) => r.dockId,
      render: (r) => r.dockId,
    },
    {
      key: "station",
      header: "Station",
      headerClassName: "w-[22%]",
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
      headerClassName: "w-[14%]",
      sortValue: (r) => (r.online ? 1 : 0),
      render: (r) => <StatusDot status={r.online ? "ONLINE" : "OFFLINE"} />,
    },
    {
      key: "faulty",
      header: "Faulty",
      headerClassName: "w-[12%]",
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
      headerClassName: "w-[20%]",
      sortValue: (r) => (r.lastSeen ? new Date(r.lastSeen).getTime() : 0),
      render: (r) => <span className="whitespace-nowrap tabular-nums">{lastSeenLabel(r.lastSeen)}</span>,
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.chargerId}
      // No charger detail screen exists; a charger's home is its station page.
      rowHref={(r) => `/stations/${r.stationId}`}
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
