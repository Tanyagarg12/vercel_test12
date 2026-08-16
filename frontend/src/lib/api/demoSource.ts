// Demo-mode source.
//
// Builds the *same* `ApiCommandCenter` payload shape from the local synthetic
// generator, so the dashboard renders through one code path whether it is
// reading the live service or running offline. That means the UI is genuinely
// verified against the API contract before the service is reachable.
//
// It deliberately populates the four fields the service does not send yet
// (health_trend, maintenance_due_count, station_id, failure_in_hours) so the
// panels that depend on them can be seen working; live mode leaves them null
// and those panels hide themselves.

import {
  FAILURE_MODES,
  getAtRiskBatteries,
  getFleet,
  getHealthTrend,
  type Battery,
} from "@/lib/mock";
import type { ApiCommandCenter, ApiHealthTrendPoint } from "./types";

/** Health bands used to place a score into the API's four condition states. */
function classify(score: number): "HEALTHY" | "WATCH" | "AT_RISK" | "CRITICAL" {
  if (score >= 85) return "HEALTHY";
  if (score >= 70) return "WATCH";
  if (score >= 40) return "AT_RISK";
  return "CRITICAL";
}

function riskCategoryOf(percent: number): string {
  if (percent >= 81) return "CRITICAL";
  if (percent >= 61) return "HIGH";
  if (percent >= 31) return "MODERATE";
  return "LOW";
}

function severityOf(battery: Battery): string {
  if (battery.risk.category === "Critical") return "CRITICAL";
  if (battery.risk.category === "High") return "HIGH";
  return "WARNING";
}

function isoAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString().slice(0, 19);
}

export function buildDemoCommandCenter(): ApiCommandCenter {
  const fleet = getFleet();
  const batteries = fleet.batteries;
  const total = batteries.length;

  const online = batteries.filter((b) => b.status !== "OFFLINE");
  const offlineCount = total - online.length;

  const states = { HEALTHY: 0, WATCH: 0, AT_RISK: 0, CRITICAL: 0 };
  online.forEach((b) => {
    states[classify(b.health.score)] += 1;
  });

  const ranked = getAtRiskBatteries(fleet);
  const highRisk = ranked.filter(
    (b) => b.risk.category === "High" || b.risk.category === "Critical",
  );
  const predicted = batteries.filter((b) => b.risk.category === "Critical").length;
  const maintenanceDue = batteries.filter((b) => b.risk.category === "Moderate").length;

  const alerts = highRisk.slice(0, 4).map((b, idx) => ({
    timestamp: isoAgo(4 + idx * 7),
    category: b.failureMode ? "BATTERY_ALERT" : "STATION_ALERT",
    severity: severityOf(b),
    entity_type: "battery",
    entity_id: b.batteryId,
    station_id: b.stationId,
    description: b.failureMode ? FAILURE_MODES[b.failureMode].alertTitle : "Predicted degradation",
  }));

  const faultyCharger = fleet.chargers.find((c) => c.status === "FAULTY");
  if (faultyCharger) {
    alerts.push({
      timestamp: isoAgo(38),
      category: "CHARGER_FAULT",
      severity: "HIGH",
      entity_type: "charger",
      entity_id: faultyCharger.chargerId,
      station_id: faultyCharger.stationId,
      description: "Fault code CHG_TEMP_HIGH",
    });
  }

  const reasonCounts = new Map<string, number>();
  ranked.forEach((b) => {
    if (!b.failureMode) return;
    const reason = FAILURE_MODES[b.failureMode].reason;
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  });
  const reasonTotal = [...reasonCounts.values()].reduce((sum, v) => sum + v, 0);

  const trend: ApiHealthTrendPoint[] = getHealthTrend(fleet).map((point, idx, all) => {
    const day = new Date();
    day.setDate(day.getDate() - (all.length - 1 - idx));
    const pctToCount = (pct: number) => Math.round((pct / 100) * total);
    return {
      date: day.toISOString().slice(0, 10),
      total,
      healthy_count: pctToCount(point.healthy),
      healthy_percent: Math.round(point.healthy * 10) / 10,
      warning_count: pctToCount(point.warning),
      warning_percent: Math.round(point.warning * 10) / 10,
      critical_count: pctToCount(point.critical),
      critical_percent: Math.round(point.critical * 10) / 10,
    };
  });

  const overallHealth =
    batteries.reduce((sum, b) => sum + b.health.score, 0) / (total || 1);

  return {
    stations: {
      total: fleet.stations.length,
      online: fleet.stations.filter((s) => s.status === "ONLINE").length,
      offline: fleet.stations.filter((s) => s.status === "OFFLINE").length,
    },
    chargers: {
      total: fleet.chargers.length,
      online: fleet.chargers.filter((c) => c.status === "ONLINE").length,
      offline: fleet.chargers.filter((c) => c.status === "FAULTY").length,
      faulty: fleet.chargers.filter((c) => c.status === "FAULTY").length,
    },
    batteries: {
      overall_health_score: Math.round(overallHealth * 10) / 10,
      overall_health_classification: classify(overallHealth),
      total,
      healthy: states.HEALTHY,
      watch: states.WATCH,
      at_risk: states.AT_RISK,
      critical: states.CRITICAL,
      offline: offlineCount,
      high_risk_count: highRisk.length,
      predicted_failure_count: predicted,
      maintenance_due_count: maintenanceDue,
    },
    top_critical_alerts: alerts
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 5),
    top_at_risk_batteries: ranked.slice(0, 5).map((b) => ({
      battery_id: b.batteryId,
      station_id: b.stationId,
      health_score: b.health.score,
      health_classification: classify(b.health.score),
      anomaly_score: b.anomaly.score,
      anomaly_severity: b.anomaly.severity,
      risk_score: b.risk.percent,
      risk_category: riskCategoryOf(b.risk.percent),
      priority: b.risk.priority,
      likely_issue: b.risk.likelyIssue,
      prediction_window: `${b.risk.predictionWindowHours} hours`,
      failure_in_hours: b.risk.failureInHours,
    })),
    top_failure_reasons: [...reasonCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({
        reason,
        count,
        percent: reasonTotal ? Math.round((count / reasonTotal) * 1000) / 10 : 0,
      })),
    health_trend: trend,
  };
}
