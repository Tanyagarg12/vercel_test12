// Single entry point the dashboard calls.
//
// The command centre gives the KPI blocks, alerts and at-risk list; three
// purpose-built endpoints supply the donut, the trend chart and the risk
// summary. Each of those three degrades on its own — losing the trend must not
// blank the KPIs — so they are fetched with individual catches.
//
// Falls back to the local synthetic dataset when the service is unreachable, so
// a demo always has something on screen. Which source produced the numbers is
// returned alongside the data and shown in the header.

import {
  ApiUnavailableError,
  apiBaseUrl,
  fetchBatteryHealthTrend,
  fetchChargers,
  fetchCommandCenter,
  fetchHealthDistribution,
  fetchRiskSummary,
  fetchStations,
} from "./client";
import { buildDemoCommandCenter } from "./demoSource";
import {
  normaliseCharger,
  normaliseCommandCenter,
  normaliseDistribution,
  normaliseStation,
  normaliseTrend,
  type ChargerRow,
  type DashboardData,
  type StationRow,
} from "./normalise";

export interface DashboardResult {
  data: DashboardData;
  /** Individual stations and chargers, so the KPI cards can rank them. */
  stations: StationRow[];
  chargers: ChargerRow[];
  /** Why the live service was not used, when it wasn't. */
  fallbackReason: string | null;
}

function demoResult(reason: string): DashboardResult {
  const payload = buildDemoCommandCenter();
  const data = normaliseCommandCenter(payload, "demo");
  return {
    data: {
      ...data,
      healthBuckets: [],
      healthTrend: normaliseTrend(payload.health_trend),
    },
    stations: [],
    chargers: [],
    fallbackReason: reason,
  };
}

export async function getDashboardData(trendDays = 7): Promise<DashboardResult> {
  if (!apiBaseUrl()) return demoResult("API_BASE_URL is not set");

  try {
    const [payload, distribution, riskSummary, trend, stations, chargers] = await Promise.all([
      fetchCommandCenter(),
      fetchHealthDistribution().catch(() => null),
      fetchRiskSummary().catch(() => null),
      fetchBatteryHealthTrend(trendDays).catch(() => null),
      fetchStations().catch(() => []),
      fetchChargers().catch(() => []),
    ]);

    const data = normaliseCommandCenter(payload, "api");

    return {
      data: {
        ...data,
        healthBuckets: distribution ? normaliseDistribution(distribution) : [],
        distributionTotal: distribution?.total ?? data.batteries.total,
        batteries: {
          ...data.batteries,
          // The command centre does not carry a maintenance-due count; the
          // dedicated risk-summary endpoint does.
          maintenanceDue: riskSummary?.maintenance_due.count ?? data.batteries.maintenanceDue,
        },
        riskNotes: { maintenanceDue: riskSummary?.maintenance_due.note ?? null },
        healthTrend: normaliseTrend(trend) ?? data.healthTrend,
      },
      stations: stations.map(normaliseStation),
      chargers: chargers.map(normaliseCharger),
      fallbackReason: null,
    };
  } catch (error) {
    const reason =
      error instanceof ApiUnavailableError ? error.message : "unexpected error contacting the API";
    return demoResult(reason);
  }
}
