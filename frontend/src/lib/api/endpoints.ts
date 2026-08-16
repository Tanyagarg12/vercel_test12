// The complete API surface, in one place.
//
// Interactive reference (Swagger UI): {API_BASE_URL}/docs
// Machine-readable schema:            {API_BASE_URL}/openapi.json
//
// Every path the dashboard can call is declared here rather than written inline
// at each call site, so the full surface is visible in one file, typos are
// caught by the compiler, and query parameters are built consistently.
//
// Keep this in sync with /docs.

function qs(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) return "";
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")}`;
}

const id = (value: string) => encodeURIComponent(value);

export const ENDPOINTS = {
  // --- Service ---
  health: () => "/health",

  // --- Dashboard ---
  commandCenter: () => "/dashboard/command-center",

  // --- Batteries ---
  batteries: (p: { classification?: string; riskCategory?: string } = {}) =>
    `/batteries${qs({ classification: p.classification, risk_category: p.riskCategory })}`,
  battery: (batteryId: string) => `/batteries/${id(batteryId)}`,
  batterySummary: () => "/batteries/summary",
  batteryHealthTrend: (days = 7) => `/batteries/health/trend${qs({ days })}`,
  batteriesTopRisk: (sortBy = "risk", order: "asc" | "desc" = "desc") =>
    `/batteries/risk/top${qs({ sort_by: sortBy, order })}`,

  // --- Assets (QIS docks) ---
  assets: (p: { classification?: string; riskCategory?: string } = {}) =>
    `/assets${qs({ classification: p.classification, risk_category: p.riskCategory })}`,
  asset: (assetId: string) => `/assets/${id(assetId)}`,
  assetEvents: (assetId: string, limit?: number) => `/assets/${id(assetId)}/events${qs({ limit })}`,
  assetTelemetry: (assetId: string, days = 7) => `/assets/${id(assetId)}/telemetry${qs({ days })}`,

  // --- Stations & chargers ---
  stations: () => "/stations",
  stationsSummary: () => "/stations/summary",
  chargers: () => "/chargers",
  chargersSummary: () => "/chargers/summary",

  // --- Operations ---
  operationsSummary: () => "/operations/summary",
  operationsAlerts: (limit?: number) => `/operations/alerts${qs({ limit })}`,
  operationsRisk: (sortBy?: string, order?: "asc" | "desc") =>
    `/operations/risk${qs({ sort_by: sortBy, order })}`,
  operationsRiskSummary: () => "/operations/risk-summary",
  operationsHealthDistribution: () => "/operations/health-distribution",
  operationsFailureReasons: (p: { limit?: number; scope?: string } = {}) =>
    `/operations/failure-reasons${qs({ limit: p.limit, scope: p.scope })}`,
  operationsRecommendations: (priority?: string) =>
    `/operations/recommendations${qs({ priority })}`,
  fieldActions: () => "/operations/field-actions",

  // --- Copilot ---
  copilotAsk: () => "/copilot/ask",
  copilotContext: () => "/copilot/context",
  copilotExampleQuestions: () => "/copilot/example-questions",

  // --- Demo controls ---
  demoScenarios: () => "/demo/scenarios",
  demoDatasets: () => "/demo/datasets",
  demoReset: () => "/demo/reset",
  demoInject: () => "/demo/inject",
  demoApplyPack: () => "/demo/apply-pack",
} as const;
