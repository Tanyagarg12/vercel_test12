// Normalises the API payload into the view model the dashboard renders.
//
// The four fields still to be added on the service side are modelled as
// nullable here, so the UI can hide those panels instead of showing zeros:
//   - batteries.maintenance_due_count  -> maintenanceDue
//   - health_trend                     -> healthTrend
//   - top_at_risk_batteries[].station_id      -> row.stationId
//   - top_at_risk_batteries[].failure_in_hours-> row.failureInHours

import type {
  ApiBattery,
  ApiHealthDistribution,
  ApiBatteryDetail,
  ApiCharger,
  ApiCommandCenter,
  ApiHealthTrendPoint,
  ApiStation,
} from "./types";

export type DataSource = "api" | "demo";

export type HealthState = "healthy" | "warning" | "critical" | "offline";
export type RiskCategory = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type AlertTone = "critical" | "serious" | "warning" | "neutral";

export interface Bucket {
  state: HealthState;
  label: string;
  count: number;
  pct: number;
}

export interface DashboardAlert {
  key: string;
  title: string;
  entityLabel: string;
  stationId: string;
  timestamp: string;
  severity: string;
  tone: AlertTone;
}

export interface AtRiskRow {
  batteryId: string;
  stationId: string | null;
  healthScore: number;
  healthClassification: string;
  riskScore: number;
  riskCategory: RiskCategory;
  priority: string;
  likelyIssue: string;
  predictionWindow: string;
  failureInHours: number | null;
}

export interface TrendPoint {
  label: string;
  /** Percentages, matching the chart's "% of batteries" axis. */
  healthy: number;
  warning: number;
  critical: number;
}

export interface DashboardData {
  source: DataSource;
  stations: { total: number; online: number; offline: number };
  chargers: { total: number; online: number; offline: number; faulty: number };
  batteries: {
    total: number;
    overallHealth: number;
    classification: string;
    highRisk: number;
    predictedFailures: number;
    /** null until the service exposes it — the tile is hidden when null. */
    maintenanceDue: number | null;
  };
  healthBuckets: Bucket[];
  /** Total the donut is drawn from — all monitored assets, not just batteries. */
  distributionTotal: number;
  riskNotes: { maintenanceDue: string | null };
  alerts: DashboardAlert[];
  atRisk: AtRiskRow[];
  failureReasons: { reason: string; count: number; pct: number }[];
  /** null until the service exposes it — the chart is hidden when null. */
  healthTrend: TrendPoint[] | null;
}

const STATE_LABEL: Record<HealthState, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
  offline: "Offline",
};

/** Severity strings are free-form in the schema, so match generously and fall
 * back to neutral rather than mis-colouring an unknown value. */
export function alertTone(severity: string): AlertTone {
  const s = severity.toUpperCase();
  if (s.includes("CRITICAL") || s.includes("FATAL")) return "critical";
  if (s.includes("HIGH") || s.includes("SEVERE") || s.includes("ERROR")) return "serious";
  if (s.includes("WARN") || s.includes("MEDIUM") || s.includes("MODERATE")) return "warning";
  return "neutral";
}

export function riskCategory(value: string): RiskCategory {
  const v = value.toUpperCase();
  if (v.includes("CRITICAL")) return "CRITICAL";
  if (v.includes("HIGH")) return "HIGH";
  if (v.includes("MODERATE") || v.includes("MEDIUM")) return "MODERATE";
  return "LOW";
}

/** Turns a category/description pair into an alert headline. */
function alertTitle(category: string, description: string): string {
  const readable = category
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return description?.trim() ? description : readable;
}

function entityLabel(entityType: string, entityId: string): string {
  const type = entityType ? entityType.charAt(0).toUpperCase() + entityType.slice(1) : "Entity";
  return `${type} ID: ${entityId}`;
}

function trendLabel(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function normaliseTrend(points: ApiHealthTrendPoint[] | null | undefined): TrendPoint[] | null {
  if (!points || points.length === 0) return null;
  return points.map((point) => ({
    label: trendLabel(point.date),
    healthy: point.healthy_percent,
    warning: point.warning_percent,
    critical: point.critical_percent,
  }));
}

export function normaliseCommandCenter(payload: ApiCommandCenter, source: DataSource): DashboardData {
  const b = payload.batteries;
  const total = b.total;

  return {
    source,
    stations: payload.stations,
    chargers: payload.chargers,
    batteries: {
      total,
      overallHealth: b.overall_health_score,
      classification: b.overall_health_classification,
      highRisk: b.high_risk_count,
      predictedFailures: b.predicted_failure_count,
      maintenanceDue: b.maintenance_due_count ?? null,
    },
    alerts: (payload.top_critical_alerts ?? []).map((alert, idx) => ({
      key: `${alert.entity_id}-${alert.timestamp}-${idx}`,
      title: alertTitle(alert.category, alert.description),
      entityLabel: entityLabel(alert.entity_type, alert.entity_id),
      stationId: alert.station_id,
      timestamp: alert.timestamp,
      severity: alert.severity,
      tone: alertTone(alert.severity),
    })),
    atRisk: (payload.top_at_risk_batteries ?? []).map((row) => ({
      batteryId: row.battery_id,
      stationId: row.station_id ?? null,
      healthScore: row.health_score,
      healthClassification: row.health_classification,
      riskScore: row.risk_score,
      riskCategory: riskCategory(row.risk_category),
      priority: row.priority,
      likelyIssue: row.likely_issue,
      predictionWindow: row.prediction_window,
      failureInHours: row.failure_in_hours ?? null,
    })),
    failureReasons: (payload.top_failure_reasons ?? []).map((r) => ({
      reason: r.reason,
      count: r.count,
      pct: r.percent,
    })),
    healthBuckets: [],
    distributionTotal: total,
    riskNotes: { maintenanceDue: null },
    healthTrend: normaliseTrend(payload.health_trend),
  };
}

// ---------------------------------------------------------------------------
// Battery / station / charger view models
// ---------------------------------------------------------------------------

export interface BatteryRow {
  batteryId: string;
  healthScore: number;
  healthClassification: string;
  anomalyScore: number;
  anomalySeverity: string;
  riskScore: number;
  riskCategory: RiskCategory;
  riskCategoryRaw: string;
  priority: string;
  likelyIssue: string;
  predictionWindow: string;
  stationId: string | null;
}

export interface BatteryDetailView extends BatteryRow {
  /** Ordered for display; the service returns an open-ended map of dimensions. */
  dimensions: { key: string; label: string; score: number }[];
  detectedSignals: string[];
  sla: string;
  businessImpact: string;
  suggestedChecks: string[];
  riskNote: string;
  scoredAt: string;
}

export interface StationRow {
  stationId: string;
  name: string;
  online: boolean;
  dockCount: number;
  chargersOnline: number;
  chargersOffline: number;
  avgHealthScore: number;
  healthyDocks: number;
  atRiskDocks: number;
  criticalDocks: number;
  highRiskDocks: number;
  latitude: number | null;
  longitude: number | null;
}

export interface ChargerRow {
  chargerId: string;
  dockId: string;
  stationId: string;
  online: boolean;
  faulty: boolean;
  /** Null when the charger has never reported. */
  lastSeen: string | null;
}

/** Turns an API dimension key such as `charging_electrical` into a label. */
function dimensionLabel(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normaliseBattery(row: ApiBattery): BatteryRow {
  return {
    batteryId: row.battery_id,
    healthScore: row.health_score,
    healthClassification: row.health_classification,
    anomalyScore: row.anomaly_score,
    anomalySeverity: row.anomaly_severity,
    riskScore: row.risk_score,
    riskCategory: riskCategory(row.risk_category),
    riskCategoryRaw: row.risk_category,
    priority: row.priority,
    likelyIssue: row.likely_issue,
    predictionWindow: row.prediction_window,
    stationId: row.station_id ?? null,
  };
}

export function normaliseBatteryDetail(detail: ApiBatteryDetail): BatteryDetailView {
  return {
    ...normaliseBattery(detail),
    dimensions: Object.entries(detail.dimension_scores ?? {}).map(([key, score]) => ({
      key,
      label: dimensionLabel(key),
      score,
    })),
    detectedSignals: detail.detected_signals ?? [],
    sla: detail.sla,
    businessImpact: detail.business_impact,
    suggestedChecks: detail.suggested_checks ?? [],
    riskNote: detail.risk_note,
    scoredAt: detail.scored_at,
  };
}

export function normaliseStation(row: ApiStation): StationRow {
  return {
    stationId: row.station_id,
    name: row.name ?? row.location ?? row.station_id,
    online: row.online,
    dockCount: row.dock_count,
    chargersOnline: row.chargers_online,
    chargersOffline: row.chargers_offline,
    avgHealthScore: row.avg_health_score,
    healthyDocks: row.healthy_docks,
    atRiskDocks: row.at_risk_docks,
    criticalDocks: row.critical_docks,
    highRiskDocks: row.high_risk_docks,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
  };
}

export function normaliseCharger(row: ApiCharger): ChargerRow {
  return {
    chargerId: row.charger_id,
    dockId: row.dock_id,
    stationId: row.station_id,
    online: row.online,
    faulty: row.faulty,
    lastSeen: row.last_seen ?? null,
  };
}

/** Buckets for the Asset Health Distribution donut, from
 * GET /operations/health-distribution. */
export function normaliseDistribution(dist: ApiHealthDistribution): Bucket[] {
  return (
    [
      ["healthy", dist.healthy],
      ["warning", dist.warning],
      ["critical", dist.critical],
      ["offline", dist.offline],
    ] as [HealthState, { count: number; percent: number }][]
  ).map(([state, bucket]) => ({
    state,
    label: STATE_LABEL[state],
    count: bucket?.count ?? 0,
    pct: bucket?.percent ?? 0,
  }));
}
