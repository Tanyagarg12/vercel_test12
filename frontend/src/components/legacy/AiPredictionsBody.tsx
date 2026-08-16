"use client";

import Link from "next/link";
import { AlertOctagon, AlertTriangle, Sparkles, Wrench } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { HealthBar } from "@/components/ui/HealthBar";
import { Panel } from "@/components/ui/Panel";
import { RiskPill } from "@/components/ui/RiskPill";
import { StatCard } from "@/components/ui/StatCard";
import {
  getAtRiskBatteries,
  getFleet,
  getRiskSummary,
  type Battery,
} from "@/lib/mock";

const PRIORITY_TONE = {
  P1: "var(--status-critical)",
  P2: "var(--status-warning)",
  P3: "var(--text-muted)",
} as const;

export function AiPredictionsBody() {
  const fleet = getFleet();
  const atRisk = getAtRiskBatteries(fleet);
  const summary = getRiskSummary(fleet);

  const columns: Column<Battery>[] = [
    {
      key: "batteryId",
      header: "Battery ID",
      sortValue: (b) => b.batteryId,
      render: (b) => (
        <Link href={`/batteries/${b.batteryId}`} className="font-medium text-[var(--series-1)] hover:underline">
          {b.batteryId}
        </Link>
      ),
    },
    { key: "station", header: "Station", sortValue: (b) => b.stationLabel, render: (b) => b.stationLabel },
    {
      key: "risk",
      header: "Risk Score",
      sortValue: (b) => b.risk.percent,
      render: (b) => <RiskPill percent={b.risk.percent} category={b.risk.category} showCategory />,
    },
    { key: "issue", header: "Predicted Issue", sortValue: (b) => b.risk.reason, render: (b) => b.risk.reason },
    {
      key: "window",
      header: "Window",
      align: "right",
      sortValue: (b) => b.risk.predictionWindowHours,
      render: (b) => <span className="tabular-nums">{b.risk.predictionWindowHours}h</span>,
    },
    {
      key: "failureIn",
      header: "Failure In",
      align: "right",
      sortValue: (b) => b.risk.failureInHours ?? 999,
      render: (b) =>
        b.risk.failureInHours ? (
          <span className="tabular-nums">{b.risk.failureInHours} Hrs</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    { key: "impact", header: "Impact", sortValue: (b) => b.risk.impact, render: (b) => b.risk.impact },
    {
      key: "priority",
      header: "Priority",
      sortValue: (b) => b.risk.priority,
      render: (b) => (
        <span className="font-semibold" style={{ color: PRIORITY_TONE[b.risk.priority] }}>
          {b.risk.priority}
        </span>
      ),
    },
    {
      key: "health",
      header: "Health",
      sortValue: (b) => b.health.score,
      render: (b) => <HealthBar score={b.health.score} />,
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            icon={AlertTriangle}
            iconBg="var(--status-critical-bg)"
            iconColor="var(--status-critical)"
            label="High Risk Assets"
            value={summary.highRiskAssets.count}
            breakdown={[{ label: "of total", value: `${summary.highRiskAssets.pct}%`, tone: "critical" }]}
          />
          <StatCard
            icon={Wrench}
            iconBg="var(--status-warning-bg)"
            iconColor="var(--status-warning)"
            label="Maintenance Due"
            value={summary.maintenanceDue.count}
            breakdown={[{ label: "of total", value: `${summary.maintenanceDue.pct}%`, tone: "warning" }]}
          />
          <StatCard
            icon={AlertOctagon}
            iconBg="color-mix(in srgb, var(--series-7) 14%, transparent)"
            iconColor="var(--series-7)"
            label="Predicted Failures (48h)"
            value={summary.predictedFailures.count}
            breakdown={[{ label: "of total", value: `${summary.predictedFailures.pct}%`, tone: "critical" }]}
          />
        </div>

        <Panel title="At-Risk Assets" titleNote={`(${atRisk.length.toLocaleString()} flagged)`}>
          <DataTable
            rows={atRisk}
            columns={columns}
            rowKey={(b) => b.batteryId}
            searchFields={(b) => [b.batteryId, b.stationLabel, b.city, b.risk.reason, b.risk.priority]}
            searchPlaceholder="Search battery, station or predicted issue…"
            filters={{
              options: [
                { value: "Critical", label: "Critical", count: atRisk.filter((b) => b.risk.category === "Critical").length },
                { value: "High", label: "High", count: atRisk.filter((b) => b.risk.category === "High").length },
                { value: "Moderate", label: "Moderate", count: atRisk.filter((b) => b.risk.category === "Moderate").length },
              ],
              predicate: (b, value) => b.risk.category === value,
            }}
            initialSort={{ key: "risk", direction: "desc" }}
          />
        </Panel>

        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-1)] px-5 py-4">
          <Sparkles size={16} className="mt-0.5 flex-none text-[var(--series-1)]" />
          <p className="text-[13px] leading-relaxed text-text-secondary">
            <span className="font-semibold text-text-primary">Predictive Risk / Early Warning.</span> These
            scores express the likelihood of an operational issue developing inside the prediction window,
            based on recent telemetry trends. They are not confirmed failure predictions — every asset listed
            here is still in service, and is surfaced so a field action can happen before the issue becomes an
            incident.
          </p>
        </div>
      </div>
    </div>
  );
}
