// Wire types for the AI Asset Intelligence Platform API.
//
// These mirror GET /dashboard/command-center exactly as the service returns it
// — snake_case and all — so the boundary is obvious. Everything downstream
// works from the normalised view model in `normalise.ts` instead.

export interface ApiStationCounts {
  total: number;
  online: number;
  offline: number;
}

export interface ApiChargerCounts {
  total: number;
  online: number;
  offline: number;
  /** Not mutually exclusive with online/offline — online + offline already
   * equals total, so a faulty charger is also counted in one of those. */
  faulty: number;
}

export interface ApiBatteryCounts {
  overall_health_score: number;
  overall_health_classification: string;
  total: number;
  healthy: number;
  watch: number;
  at_risk: number;
  critical: number;
  offline: number;
  high_risk_count: number;
  predicted_failure_count: number;
  /** Requested addition — absent until the service exposes it. */
  maintenance_due_count?: number | null;
}

export interface ApiAlert {
  timestamp: string;
  category: string;
  severity: string;
  entity_type: string;
  entity_id: string;
  station_id: string;
  description: string;
}

export interface ApiAtRiskBattery {
  battery_id: string;
  health_score: number;
  health_classification: string;
  anomaly_score: number;
  anomaly_severity: string;
  risk_score: number;
  risk_category: string;
  priority: string;
  likely_issue: string;
  prediction_window: string;
  /** Requested additions — absent until the service exposes them. */
  station_id?: string | null;
  failure_in_hours?: number | null;
}

export interface ApiFailureReason {
  reason: string;
  count: number;
  percent: number;
}

/** GET /batteries/health/trend?days=7 */
export interface ApiHealthTrendPoint {
  date: string;
  total: number;
  healthy_count: number;
  healthy_percent: number;
  warning_count: number;
  warning_percent: number;
  critical_count: number;
  critical_percent: number;
}

/** One bucket in GET /operations/health-distribution. */
export interface ApiDistributionBucket {
  count: number;
  percent: number;
}

export interface ApiDistributionGroup {
  total: number;
  healthy: ApiDistributionBucket;
  warning: ApiDistributionBucket;
  critical: ApiDistributionBucket;
  offline: ApiDistributionBucket;
}

/** GET /operations/health-distribution — all monitored assets, plus a split
 * by asset type (battery / charger / station). */
export interface ApiHealthDistribution extends ApiDistributionGroup {
  by_asset_type?: Record<string, ApiDistributionGroup>;
}

/** A risk figure from GET /operations/risk-summary. `note` explains how the
 * number was derived when it is an approximation. */
export interface ApiRiskFigure {
  count: number;
  percent: number;
  note?: string | null;
}

export interface ApiRiskSummary {
  total: number;
  window: string;
  high_risk_assets: ApiRiskFigure;
  maintenance_due: ApiRiskFigure;
  predicted_failures: ApiRiskFigure;
  by_asset_type?: Record<string, Record<string, ApiRiskFigure>>;
}

export interface ApiCommandCenter {
  stations: ApiStationCounts;
  chargers: ApiChargerCounts;
  batteries: ApiBatteryCounts;
  top_critical_alerts: ApiAlert[];
  top_at_risk_batteries: ApiAtRiskBattery[];
  top_failure_reasons: ApiFailureReason[];
  health_trend?: ApiHealthTrendPoint[] | null;
}

// ---------------------------------------------------------------------------
// GET /batteries · GET /batteries/risk/top · GET /batteries/{id}
// ---------------------------------------------------------------------------

/** A row from GET /batteries — same shape as the dashboard's at-risk entries. */
export type ApiBattery = ApiAtRiskBattery;

/** GET /batteries/{id} — the list row plus the detail-only fields. */
export interface ApiBatteryDetail extends ApiBattery {
  dimension_scores: Record<string, number>;
  detected_signals: string[];
  sla: string;
  business_impact: string;
  suggested_checks: string[];
  risk_note: string;
  scored_at: string;
}

/** GET /batteries/summary — identical to the command-center battery block. */
export type ApiBatterySummary = ApiBatteryCounts;

// ---------------------------------------------------------------------------
// GET /stations · GET /stations/summary · GET /chargers
// ---------------------------------------------------------------------------

export interface ApiStation {
  station_id: string;
  dock_count: number;
  chargers_online: number;
  chargers_offline: number;
  online: boolean;
  avg_health_score: number;
  healthy_docks: number;
  at_risk_docks: number;
  critical_docks: number;
  high_risk_docks: number;
  /** Requested additions — absent until the service exposes them. */
  latitude?: number | null;
  longitude?: number | null;
  name?: string | null;
  location?: string | null;
}

/** GET /stations/summary */
export type ApiStationSummary = ApiStationCounts;

export interface ApiCharger {
  charger_id: string;
  dock_id: string;
  station_id: string;
  online: boolean;
  faulty: boolean;
  /** Null for chargers that have never reported — offline units send null here. */
  last_seen: string | null;
}

// ---------------------------------------------------------------------------
// Demo controls (POC-09 / spec section 14 — "Demo Data Control")
// ---------------------------------------------------------------------------

export interface ApiDemoScenario {
  code: string;
  label: string;
}

export interface ApiDemoDataset {
  name: string;
  path: string;
}

/** An asset row from GET /assets — the docks that scenarios can target. */
export interface ApiAsset {
  asset_id: string;
  station_id: string;
  location: string;
  asset_type: string;
  operational_status: string;
  health_score: number;
  health_classification: string;
  anomaly_score: number;
  anomaly_severity: string;
  risk_score: number;
  risk_category: string;
  priority: string;
  likely_issue: string;
  prediction_window: string;
}

export interface ApiDemoResetResult {
  reset_at_utc: string;
  dataset: string;
  asset_count: number;
  battery_count: number;
  health_summary?: Record<string, number>;
  risk_summary?: Record<string, number>;
  battery_health_summary?: Record<string, number>;
  battery_risk_summary?: Record<string, number>;
}

/** POST /demo/inject returns the asset's freshly rescored state. */
export interface ApiDemoInjectResult {
  asset_id: string;
  scenario: string;
  scenario_label: string;
  severity: string;
  duration_days: number;
  metrics_perturbed: string[];
  health_score: number;
  health_classification: string;
  anomaly_score: number;
  anomaly_severity: string;
  risk_score: number;
  risk_category: string;
  likely_issue: string;
  priority: string;
}
