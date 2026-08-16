// Loaders for the battery / station / charger screens.
//
// Unlike the dashboard — which keeps a synthetic fallback so a demo always has
// something on screen — these screens are live-only. Falling back here would
// mean showing a different fleet with a different ID scheme (BAT-09001 vs
// BAT001), which is more confusing than an honest "service unavailable".

import {
  ApiUnavailableError,
  apiBaseUrl,
  fetchBatteries,
  fetchBattery,
  fetchBatterySummary,
  fetchAssets,
  fetchChargers,
  fetchCommandCenter,
  fetchDemoDatasets,
  fetchDemoScenarios,
  fetchStations,
  fetchStationsSummary,
} from "./client";
import type { ApiBatteryCounts } from "./types";
import {
  alertTone,
  normaliseBattery,
  normaliseBatteryDetail,
  normaliseCharger,
  normaliseStation,
  type BatteryDetailView,
  type BatteryRow,
  type AlertTone,
  type ChargerRow,
  type StationRow,
} from "./normalise";

export interface Loaded<T> {
  data: T | null;
  error: string | null;
}

const NOT_CONFIGURED = "API_BASE_URL is not set — add it to frontend/.env.local and restart.";

function describe(error: unknown): string {
  if (error instanceof ApiUnavailableError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  if (!apiBaseUrl()) return { data: null, error: NOT_CONFIGURED };
  try {
    return { data: await fn(), error: null };
  } catch (error) {
    return { data: null, error: describe(error) };
  }
}

export interface BatteriesPageData {
  rows: BatteryRow[];
  summary: ApiBatteryCounts | null;
}

export function getBatteriesPage(): Promise<Loaded<BatteriesPageData>> {
  return load(async () => {
    // The summary is a nicety for the filter chips — a failure there should not
    // take the whole table down with it.
    const [rows, summary] = await Promise.all([
      fetchBatteries(),
      fetchBatterySummary().catch(() => null),
    ]);
    return { rows: rows.map(normaliseBattery), summary };
  });
}

export function getBatteryDetail(batteryId: string): Promise<Loaded<BatteryDetailView>> {
  return load(async () => normaliseBatteryDetail(await fetchBattery(batteryId)));
}

export interface StationsPageData {
  rows: StationRow[];
  summary: { total: number; online: number; offline: number } | null;
}

export function getStationsPage(): Promise<Loaded<StationsPageData>> {
  return load(async () => {
    const [rows, summary] = await Promise.all([
      fetchStations(),
      fetchStationsSummary().catch(() => null),
    ]);
    return { rows: rows.map(normaliseStation), summary };
  });
}

export interface StationDetailData {
  station: StationRow;
  chargers: ChargerRow[];
}

/**
 * There is no GET /stations/{id}, so the detail view is assembled from the
 * station list plus the charger list filtered by station — no new endpoint
 * needed. Batteries cannot be listed per station until they carry a station_id.
 */
export function getStationDetail(stationId: string): Promise<Loaded<StationDetailData>> {
  return load(async () => {
    const [stations, chargers] = await Promise.all([fetchStations(), fetchChargers().catch(() => [])]);
    const match = stations.find((s) => s.station_id.toLowerCase() === stationId.toLowerCase());
    if (!match) throw new ApiUnavailableError(`Station ${stationId} was not found`, 404);
    return {
      station: normaliseStation(match),
      chargers: chargers
        .filter((c) => c.station_id.toLowerCase() === stationId.toLowerCase())
        .map(normaliseCharger),
    };
  });
}

export function getChargersPage(): Promise<Loaded<ChargerRow[]>> {
  return load(async () => (await fetchChargers()).map(normaliseCharger));
}

export interface HeaderAlert {
  key: string;
  title: string;
  entityLabel: string;
  stationId: string;
  severity: string;
  tone: AlertTone;
  timestamp: string;
  batteryId: string | null;
}

export interface HeaderContext {
  locations: { stationId: string; label: string; online: boolean }[];
  /** Count of unacknowledged high-severity alerts, for the bell badge. */
  alertCount: number;
  /** The most recent alerts, shown in the bell dropdown. */
  alerts: HeaderAlert[];
  /** Timestamp of the freshest data the platform returned. */
  dataAsOf: string | null;
}

/**
 * Everything the page header needs, from the live service. Each piece degrades
 * on its own — a station-list failure should not blank the alert badge.
 */
export async function getHeaderContext(): Promise<HeaderContext> {
  if (!apiBaseUrl()) return { locations: [], alertCount: 0, alerts: [], dataAsOf: null };

  const [stations, commandCenter] = await Promise.all([
    fetchStations().catch(() => []),
    fetchCommandCenter().catch(() => null),
  ]);

  const alerts = commandCenter?.top_critical_alerts ?? [];
  const timestamps = alerts
    .map((a) => a.timestamp)
    .filter(Boolean)
    .sort();

  return {
    locations: stations.map((s) => ({
      stationId: s.station_id,
      label: s.name ?? s.location ?? s.station_id,
      online: s.online,
    })),
    alertCount: alerts.filter((a) => /CRITICAL|HIGH/i.test(a.severity)).length,
    alerts: alerts.slice(0, 6).map((a, idx) => ({
      key: `${a.entity_id}-${a.timestamp}-${idx}`,
      title: a.description?.trim() || a.category.replace(/[_-]+/g, " "),
      entityLabel: `${a.entity_type.charAt(0).toUpperCase()}${a.entity_type.slice(1)} ${a.entity_id}`,
      stationId: a.station_id,
      severity: a.severity,
      tone: alertTone(a.severity),
      timestamp: a.timestamp,
      batteryId: /^BAT/i.test(a.entity_id) ? a.entity_id : null,
    })),
    dataAsOf: timestamps.length > 0 ? timestamps[timestamps.length - 1] : null,
  };
}

export interface DemoContext {
  datasets: { code: string; label: string }[];
  scenarios: { code: string; label: string }[];
  assets: { assetId: string; label: string }[];
}

/** Options for the Demo Controls panel. Each list degrades on its own so one
 * failing lookup does not take the whole panel down. */
export async function getDemoContext(): Promise<Loaded<DemoContext>> {
  return load(async () => {
    const [datasets, scenarios, assets] = await Promise.all([
      fetchDemoDatasets().catch(() => []),
      fetchDemoScenarios().catch(() => []),
      fetchAssets().catch(() => []),
    ]);

    return {
      datasets: datasets.map((d) => ({
        code: d.name,
        label: d.name.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      })),
      scenarios: scenarios.map((s) => ({ code: s.code, label: s.label })),
      assets: assets.map((a) => ({
        assetId: a.asset_id,
        label: `${a.asset_id} — ${a.health_classification.toLowerCase().replace(/_/g, " ")}, risk ${Math.round(a.risk_score)}%`,
      })),
    };
  });
}
