// API client. Reads the base URL from the server-side environment only, so the
// address (and any future key) never ships to the browser — the dashboard is a
// server component and fetches during render.

import { cache } from "react";
import { ENDPOINTS } from "./endpoints";
import type {
  ApiBattery,
  ApiBatteryDetail,
  ApiBatterySummary,
  ApiCharger,
  ApiAsset,
  ApiCommandCenter,
  ApiDemoDataset,
  ApiDemoInjectResult,
  ApiDemoResetResult,
  ApiDemoScenario,
  ApiHealthDistribution,
  ApiHealthTrendPoint,
  ApiRiskSummary,
  ApiStation,
  ApiStationSummary,
} from "./types";

// The service is deployed on a platform that cold-starts, so first requests can
// take well over ten seconds. A short timeout here silently drops the page to
// demo data, which is worse than waiting.
const TIMEOUT_MS = 25000;

/**
 * Responses are cached for a short window and tagged, rather than fetched with
 * `no-store`. The upstream takes several seconds per call and a dashboard load
 * touches five endpoints, so uncached reads meant 12-25s page loads. Scoring
 * runs on a schedule (assets carry a `scored_at` date), so a few seconds of
 * staleness costs nothing — and demo mutations call `revalidateTag` to drop the
 * cache immediately, so the screen still updates the moment data changes.
 */
export const PLATFORM_CACHE_TAG = "platform-data";
const REVALIDATE_SECONDS = 30;

export function apiBaseUrl(): string | null {
  const raw = process.env.API_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export class ApiUnavailableError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

async function getJson<T>(path: string): Promise<T> {
  const base = apiBaseUrl();
  if (!base) throw new ApiUnavailableError("The monitoring service address is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${base}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: REVALIDATE_SECONDS, tags: [PLATFORM_CACHE_TAG] },
    });

    if (!response.ok) {
      // 530 is what the Cloudflare tunnel returns when the origin is unreachable.
      throw new ApiUnavailableError(`${path} returned HTTP ${response.status}`, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiUnavailableError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new ApiUnavailableError(`${path} request failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = apiBaseUrl();
  if (!base) throw new ApiUnavailableError("The monitoring service address is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? String((payload as { detail: unknown }).detail)
          : `HTTP ${response.status}`;
      throw new ApiUnavailableError(`${path}: ${detail}`, response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiUnavailableError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new ApiUnavailableError(`${path} request failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

export const fetchCommandCenter = cache(
  (): Promise<ApiCommandCenter> =>
    getJson<ApiCommandCenter>(ENDPOINTS.commandCenter()),
);

export const fetchBatteries = cache(
  (): Promise<ApiBattery[]> =>
    getJson<ApiBattery[]>(ENDPOINTS.batteries()),
);

export const fetchBatterySummary = cache(
  (): Promise<ApiBatterySummary> =>
    getJson<ApiBatterySummary>(ENDPOINTS.batterySummary()),
);

export const fetchBattery = cache(
  (batteryId: string): Promise<ApiBatteryDetail> =>
    getJson<ApiBatteryDetail>(ENDPOINTS.battery(batteryId)),
);

export const fetchTopRiskBatteries = cache(
  (
  sortBy = "risk",
  order: "asc" | "desc" = "desc",
): Promise<ApiBattery[]> =>
    getJson<ApiBattery[]>(ENDPOINTS.batteriesTopRisk(sortBy, order)),
);

export const fetchStations = cache(
  (): Promise<ApiStation[]> =>
    getJson<ApiStation[]>(ENDPOINTS.stations()),
);

export const fetchStationsSummary = cache(
  (): Promise<ApiStationSummary> =>
    getJson<ApiStationSummary>(ENDPOINTS.stationsSummary()),
);

export const fetchChargers = cache(
  (): Promise<ApiCharger[]> =>
    getJson<ApiCharger[]>(ENDPOINTS.chargers()),
);

export const fetchHealthDistribution = cache(
  (): Promise<ApiHealthDistribution> =>
    getJson<ApiHealthDistribution>(ENDPOINTS.operationsHealthDistribution()),
);

export const fetchRiskSummary = cache(
  (): Promise<ApiRiskSummary> =>
    getJson<ApiRiskSummary>(ENDPOINTS.operationsRiskSummary()),
);

export const fetchBatteryHealthTrend = cache(
  (days = 7): Promise<ApiHealthTrendPoint[]> =>
    getJson<ApiHealthTrendPoint[]>(ENDPOINTS.batteryHealthTrend(days)),
);

// --- Demo controls -------------------------------------------------------
// These mutate the deployed demo environment, so they are never cached.

export const fetchDemoScenarios = cache(
  (): Promise<ApiDemoScenario[]> => getJson<ApiDemoScenario[]>(ENDPOINTS.demoScenarios()),
);

export const fetchDemoDatasets = cache(
  (): Promise<ApiDemoDataset[]> => getJson<ApiDemoDataset[]>(ENDPOINTS.demoDatasets()),
);

export const fetchAssets = cache((): Promise<ApiAsset[]> => getJson<ApiAsset[]>(ENDPOINTS.assets()));

export function postDemoReset(dataset?: string | null): Promise<ApiDemoResetResult> {
  return postJson<ApiDemoResetResult>(ENDPOINTS.demoReset(), dataset ? { dataset } : {});
}

export function postDemoInject(body: {
  asset_id: string;
  scenario: string;
  severity: string;
  duration_days: number;
}): Promise<ApiDemoInjectResult> {
  return postJson<ApiDemoInjectResult>(ENDPOINTS.demoInject(), body);
}
