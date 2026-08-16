"use client";

import Link from "next/link";
import { AlertTriangle, TriangleAlert } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Panel } from "@/components/ui/Panel";
import { getAlerts, getFleet, getUnacknowledgedAlertCount, type Alert } from "@/lib/mock";

const SEVERITY_STYLE = {
  Critical: { color: "var(--status-critical)", bg: "var(--status-critical-bg)" },
  High: { color: "var(--status-warning)", bg: "var(--status-warning-bg)" },
  Medium: { color: "var(--status-serious)", bg: "var(--status-serious-bg)" },
} as const;

function raisedAt(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AlertsBody() {
  const fleet = getFleet();
  const alerts = getAlerts(fleet);
  const unacked = getUnacknowledgedAlertCount(fleet);

  const columns: Column<Alert>[] = [
    {
      key: "severity",
      header: "Severity",
      sortValue: (a) => ({ Critical: 3, High: 2, Medium: 1 })[a.severity],
      render: (a) => {
        const style = SEVERITY_STYLE[a.severity];
        const Icon = a.severity === "Critical" ? TriangleAlert : AlertTriangle;
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold"
            style={{ backgroundColor: style.bg, color: style.color }}
          >
            <Icon size={12} />
            {a.severity}
          </span>
        );
      },
    },
    { key: "title", header: "Alert", sortValue: (a) => a.title, render: (a) => <span className="font-medium text-text-primary">{a.title}</span> },
    {
      key: "asset",
      header: "Asset",
      sortValue: (a) => a.assetLabel,
      render: (a) =>
        a.batteryId ? (
          <Link href={`/batteries/${a.batteryId}`} className="text-[var(--series-1)] hover:underline">
            {a.assetLabel}
          </Link>
        ) : (
          a.assetLabel
        ),
    },
    { key: "station", header: "Location", sortValue: (a) => a.stationLabel, render: (a) => a.stationLabel },
    {
      key: "raised",
      header: "Raised",
      align: "right",
      sortValue: (a) => -a.minutesAgo,
      render: (a) => (
        <span className="tabular-nums">
          {raisedAt(a.minutesAgo)}
          <span className="ml-1 text-text-muted">
            ({a.minutesAgo < 60 ? `${a.minutesAgo}m` : `${Math.floor(a.minutesAgo / 60)}h`} ago)
          </span>
        </span>
      ),
    },
    {
      key: "state",
      header: "State",
      sortValue: (a) => (a.unacknowledged ? 1 : 0),
      render: (a) =>
        a.unacknowledged ? (
          <span className="font-medium text-[var(--status-critical)]">Unacknowledged</span>
        ) : (
          <span className="text-text-muted">Acknowledged</span>
        ),
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 p-6">
        <Panel>
          <DataTable
            rows={alerts}
            columns={columns}
            rowKey={(a) => a.id}
            searchFields={(a) => [a.title, a.assetLabel, a.stationLabel, a.severity]}
            searchPlaceholder="Search alert, asset or location…"
            filters={{
              options: [
                { value: "Critical", label: "Critical", count: alerts.filter((a) => a.severity === "Critical").length },
                { value: "High", label: "High", count: alerts.filter((a) => a.severity === "High").length },
                { value: "Medium", label: "Medium", count: alerts.filter((a) => a.severity === "Medium").length },
                { value: "unacked", label: "Unacknowledged", count: unacked },
              ],
              predicate: (a, value) => (value === "unacked" ? a.unacknowledged : a.severity === value),
            }}
            initialSort={{ key: "raised", direction: "desc" }}
            pageSize={20}
          />
        </Panel>
      </div>
    </div>
  );
}
