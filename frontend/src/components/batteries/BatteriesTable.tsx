"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { HealthBar } from "@/components/ui/HealthBar";
import { RiskPill } from "@/components/ui/RiskPill";
import type { BatteryRow } from "@/lib/api/normalise";

const CLASSIFICATION_TONE: Record<string, string> = {
  HEALTHY: "var(--status-good)",
  WATCH: "var(--status-warning)",
  AT_RISK: "var(--status-serious)",
  CRITICAL: "var(--status-critical)",
};

function classificationLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The health-distribution endpoint reports four coarse bands
 * (healthy/warning/critical/offline) while individual batteries carry the finer
 * HEALTHY / WATCH / AT_RISK / CRITICAL classification. Filtering uses the coarse
 * bands so the dashboard donut and this table speak one vocabulary; the exact
 * classification is still shown per row in the Condition column.
 */
const BAND_MEMBERS: Record<string, string[]> = {
  HEALTHY: ["HEALTHY"],
  WARNING: ["WATCH", "AT_RISK"],
  CRITICAL: ["CRITICAL"],
};

function bandOf(classification: string): string | null {
  const value = classification.toUpperCase();
  const entry = Object.entries(BAND_MEMBERS).find(([, members]) => members.includes(value));
  return entry ? entry[0] : null;
}

export function BatteriesTable({ rows }: { rows: BatteryRow[] }) {
  // The Station column only appears once the service sends station_id.
  const showStation = rows.some((row) => row.stationId);
  // The dashboard donut deep-links here with ?condition=HEALTHY|WATCH|…
  const condition = useSearchParams().get("condition")?.toUpperCase() ?? null;

  const columns: Column<BatteryRow>[] = [
    {
      key: "batteryId",
      header: "Battery ID",
      sortValue: (r) => r.batteryId,
      render: (r) => (
        <Link
          href={`/batteries/${r.batteryId}`}
          className="font-medium text-[var(--series-1)] hover:underline"
        >
          {r.batteryId}
        </Link>
      ),
    },
    ...(showStation
      ? [
          {
            key: "station",
            header: "Station",
            sortValue: (r: BatteryRow) => r.stationId ?? "",
            render: (r: BatteryRow) => r.stationId ?? "—",
          },
        ]
      : []),
    {
      key: "classification",
      header: "Condition",
      sortValue: (r) => r.healthClassification,
      render: (r) => (
        <span
          className="font-medium"
          style={{ color: CLASSIFICATION_TONE[r.healthClassification.toUpperCase()] ?? "var(--text-secondary)" }}
        >
          {classificationLabel(r.healthClassification)}
        </span>
      ),
    },
    {
      key: "health",
      header: "Health Score",
      sortValue: (r) => r.healthScore,
      render: (r) => <HealthBar score={r.healthScore} />,
    },
    {
      key: "anomaly",
      header: "Anomaly",
      align: "right",
      sortValue: (r) => r.anomalyScore,
      render: (r) => (
        <span className="tabular-nums" title={r.anomalySeverity}>
          {Math.round(r.anomalyScore)}
        </span>
      ),
    },
    {
      key: "risk",
      header: "Risk",
      sortValue: (r) => r.riskScore,
      render: (r) => <RiskPill percent={r.riskScore} category={r.riskCategoryRaw} />,
    },
    {
      key: "priority",
      header: "Priority",
      sortValue: (r) => r.priority,
      render: (r) => <span className="tabular-nums text-text-secondary">{r.priority}</span>,
    },
    {
      key: "issue",
      header: "Likely Issue",
      sortValue: (r) => r.likelyIssue,
      render: (r) => (
        <span className="block max-w-[280px] truncate" title={r.likelyIssue}>
          {r.likelyIssue}
        </span>
      ),
    },
  ];

  const countOf = (band: string) => rows.filter((r) => bandOf(r.healthClassification) === band).length;

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.batteryId}
      searchFields={(r) => [r.batteryId, r.stationId ?? "", r.likelyIssue, r.riskCategoryRaw, r.priority]}
      searchPlaceholder="Search battery, issue or priority…"
      filters={{
        options: [
          { value: "HEALTHY", label: "Healthy", count: countOf("HEALTHY") },
          { value: "WARNING", label: "Warning", count: countOf("WARNING") },
          { value: "CRITICAL", label: "Critical", count: countOf("CRITICAL") },
        ],
        predicate: (r, value) => bandOf(r.healthClassification) === value,
      }}
      initialFilter={condition && condition in BAND_MEMBERS ? condition : undefined}
      initialSort={{ key: "risk", direction: "desc" }}
      pageSize={15}
    />
  );
}
