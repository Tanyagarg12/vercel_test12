// Aggregations that feed the Operations Command Center panels.

import { FAILURE_MODES, type FailureModeKey } from "./failureModes";
import { getFleet, type Battery, type Fleet } from "./fleet";
import { mulberry32 } from "./rng";

export interface CountWithPct {
  count: number;
  pct: number;
}

export interface FleetKpis {
  stations: { total: number; online: CountWithPct; offline: CountWithPct };
  chargers: { total: number; online: CountWithPct; faulty: CountWithPct };
  batteries: {
    total: number;
    healthy: CountWithPct;
    atRisk: CountWithPct;
    critical: CountWithPct;
  };
  overallHealth: number;
  healthDeltaPct: number;
}

export interface HealthBucket {
  label: "Healthy" | "Warning" | "Critical" | "Offline";
  range: string;
  count: number;
  pct: number;
}

export interface RiskSummary {
  highRiskAssets: CountWithPct;
  maintenanceDue: CountWithPct;
  predictedFailures: CountWithPct;
}

export interface Alert {
  id: string;
  batteryId: string;
  assetLabel: string;
  stationLabel: string;
  title: string;
  severity: "Critical" | "High" | "Medium";
  minutesAgo: number;
  /** Alerts raised within the last hour are still unacknowledged — this is
   * the number the sidebar and header badges show. */
  unacknowledged: boolean;
}

export interface FailureReason {
  key: FailureModeKey;
  reason: string;
  pct: number;
  count: number;
}

export interface HealthTrendPoint {
  label: string;
  healthy: number;
  warning: number;
  critical: number;
}

function withPct(count: number, total: number): CountWithPct {
  return { count, pct: total ? Math.round((count / total) * 1000) / 10 : 0 };
}

export function getFleetKpis(fleet: Fleet = getFleet()): FleetKpis {
  const { stations, chargers, batteries } = fleet;

  const stationsOnline = stations.filter((s) => s.status === "ONLINE").length;
  const chargersOnline = chargers.filter((c) => c.status === "ONLINE").length;

  const healthy = batteries.filter((b) => b.health.classification === "Healthy").length;
  const warning = batteries.filter((b) => b.health.classification === "Warning").length;
  const critical = batteries.filter((b) => b.health.classification === "Critical").length;

  const overallHealth =
    batteries.reduce((sum, b) => sum + b.health.score, 0) / (batteries.length || 1);

  return {
    stations: {
      total: stations.length,
      online: withPct(stationsOnline, stations.length),
      offline: withPct(stations.length - stationsOnline, stations.length),
    },
    chargers: {
      total: chargers.length,
      online: withPct(chargersOnline, chargers.length),
      faulty: withPct(chargers.length - chargersOnline, chargers.length),
    },
    batteries: {
      total: batteries.length,
      healthy: withPct(healthy, batteries.length),
      atRisk: withPct(warning, batteries.length),
      critical: withPct(critical, batteries.length),
    },
    overallHealth: Math.round(overallHealth * 10) / 10,
    healthDeltaPct: 8.6,
  };
}

/**
 * Donut buckets. Offline batteries are pulled into their own bucket and
 * removed from the health bands — an unreachable pack has no current
 * health reading to classify — so the four buckets sum to the fleet total.
 */
export function getHealthDistribution(fleet: Fleet = getFleet()): HealthBucket[] {
  const { batteries } = fleet;
  const total = batteries.length;
  const online = batteries.filter((b) => b.status !== "OFFLINE");
  const offline = total - online.length;

  const counts = {
    Healthy: online.filter((b) => b.health.classification === "Healthy").length,
    Warning: online.filter((b) => b.health.classification === "Warning").length,
    Critical: online.filter((b) => b.health.classification === "Critical").length,
  };

  return [
    { label: "Healthy", range: "70-100", count: counts.Healthy, pct: withPct(counts.Healthy, total).pct },
    { label: "Warning", range: "40-70", count: counts.Warning, pct: withPct(counts.Warning, total).pct },
    { label: "Critical", range: "0-40", count: counts.Critical, pct: withPct(counts.Critical, total).pct },
    { label: "Offline", range: "no signal", count: offline, pct: withPct(offline, total).pct },
  ];
}

export function getRiskSummary(fleet: Fleet = getFleet()): RiskSummary {
  const { batteries } = fleet;
  const total = batteries.length;
  const highRisk = batteries.filter((b) => b.risk.category === "High" || b.risk.category === "Critical");
  const maintenanceDue = batteries.filter((b) => b.risk.category === "Moderate");
  const predicted = batteries.filter((b) => b.risk.category === "Critical");

  return {
    highRiskAssets: withPct(highRisk.length, total),
    maintenanceDue: withPct(maintenanceDue.length, total),
    predictedFailures: withPct(predicted.length, total),
  };
}

/**
 * The risk register, worst first. Risk saturates near 99% for the sickest
 * packs, so ties break on anomaly score (how far behaviour has diverged) and
 * then on health (how bad the pack already is) — which keeps the ordering
 * stable and operationally meaningful rather than dependent on fleet order.
 */
export function getAtRiskBatteries(fleet: Fleet = getFleet()): Battery[] {
  return fleet.batteries
    .filter((b) => b.risk.category !== "Low")
    .sort(
      (a, b) =>
        b.risk.percent - a.risk.percent ||
        b.anomaly.score - a.anomaly.score ||
        a.health.score - b.health.score,
    );
}

const ALERT_FEED_HOURS = 12;
const UNACKNOWLEDGED_WINDOW_MINUTES = 60;

/**
 * The single alert feed behind the header badge, the dashboard's Top
 * Critical Alerts panel and the Alerts page — so all three agree.
 * Highest-risk assets raise the most recent alerts.
 */
let cachedAlerts: Alert[] | null = null;

export function getAlerts(fleet: Fleet = getFleet()): Alert[] {
  if (cachedAlerts) return cachedAlerts;

  const rng = mulberry32(99);
  const feed: Alert[] = [];

  getAtRiskBatteries(fleet)
    .filter((b) => b.risk.category === "High" || b.risk.category === "Critical")
    .slice(0, 60)
    .forEach((b, idx) => {
      feed.push({
        id: `AL-${b.batteryId}`,
        batteryId: b.batteryId,
        assetLabel: `Battery ID: ${b.batteryId}`,
        stationLabel: b.stationLabel,
        title: b.failureMode ? FAILURE_MODES[b.failureMode].alertTitle : "Predicted Degradation",
        severity: b.risk.category === "Critical" ? "Critical" : "High",
        // Riskiest assets alerted most recently.
        minutesAgo: Math.round(2 + idx * (ALERT_FEED_HOURS * 60 / 70) + rng() * 6),
        unacknowledged: false,
      });
    });

  fleet.stations
    .filter((s) => s.status === "OFFLINE")
    .slice(0, 8)
    .forEach((s, idx) => {
      feed.push({
        id: `AL-${s.stationId}`,
        batteryId: "",
        assetLabel: `Station ID: ${s.stationId}`,
        stationLabel: s.city,
        title: "Station Offline",
        severity: "High",
        minutesAgo: Math.round(8 + idx * 37 + rng() * 15),
        unacknowledged: false,
      });
    });

  fleet.chargers
    .filter((c) => c.status === "FAULTY")
    .slice(0, 10)
    .forEach((c, idx) => {
      feed.push({
        id: `AL-${c.chargerId}`,
        batteryId: "",
        assetLabel: `Charger ID: ${c.chargerId}`,
        stationLabel: `${c.stationId} ${c.city}`,
        title: "Charger Fault Detected",
        severity: "Medium",
        minutesAgo: Math.round(14 + idx * 44 + rng() * 20),
        unacknowledged: false,
      });
    });

  feed.sort((a, b) => a.minutesAgo - b.minutesAgo);
  feed.forEach((alert) => {
    alert.unacknowledged = alert.minutesAgo <= UNACKNOWLEDGED_WINDOW_MINUTES;
  });

  cachedAlerts = feed;
  return feed;
}

export function getUnacknowledgedAlertCount(fleet: Fleet = getFleet()): number {
  return getAlerts(fleet).filter((a) => a.unacknowledged).length;
}

export function getTopCriticalAlerts(fleet: Fleet = getFleet(), limit = 5): Alert[] {
  return getAlerts(fleet).slice(0, limit);
}

export function getTopFailureReasons(fleet: Fleet = getFleet(), limit = 5): FailureReason[] {
  const counts = new Map<FailureModeKey, number>();
  getAtRiskBatteries(fleet).forEach((b) => {
    if (b.failureMode) counts.set(b.failureMode, (counts.get(b.failureMode) ?? 0) + 1);
  });

  const total = [...counts.values()].reduce((sum, v) => sum + v, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      reason: FAILURE_MODES[key].reason,
      count,
      pct: withPct(count, total).pct,
    }));
}

/**
 * Seven-day health mix. The current day is the real computed distribution;
 * earlier days walk the mix backwards, since assets currently mid-ramp on a
 * degradation scenario were in a healthier band a week ago.
 */
export function getHealthTrend(fleet: Fleet = getFleet()): HealthTrendPoint[] {
  const buckets = getHealthDistribution(fleet);
  const total = fleet.batteries.length;
  const currentHealthy = (buckets[0].count / total) * 100;
  const currentWarning = (buckets[1].count / total) * 100;
  const currentCritical = (buckets[2].count / total) * 100;

  const rng = mulberry32(31);
  const today = new Date();

  return Array.from({ length: 7 }, (_, idx) => {
    const daysAgo = 6 - idx;
    const day = new Date(today);
    day.setDate(day.getDate() - daysAgo);

    const drift = daysAgo / 6;
    const noise = () => (rng() - 0.5) * 0.7;
    const warning = currentWarning - drift * 2.4 + noise();
    const critical = currentCritical - drift * 1.1 + noise();

    return {
      label: day.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      healthy: Math.round((currentHealthy + drift * 3.5 + noise()) * 10) / 10,
      warning: Math.round(warning * 10) / 10,
      critical: Math.round(critical * 10) / 10,
    };
  });
}
