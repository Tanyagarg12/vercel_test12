// The four failure scenarios from section 6 of the Phase 1 requirements
// (POC-02 — Failure Scenario Engine). These are also exactly what the platform
// returns from GET /demo/scenarios, so the dashboard, the demo controls and the
// requirements document all use one vocabulary.
//
// The platform's `top_failure_reasons` are raw signal names ("Temperature trend
// rising", "Efficiency trend declining"). Operations staff think in scenarios,
// not signals, so those signals are rolled up into the scenario each one
// belongs to, using the signal lists in section 6:
//
//   6.1 Cooling degradation      temperature ↑, temperature variance ↑,
//                                charging duration ↑, current fluctuation ↑
//   6.2 Charging subsystem       current fluctuation ↑, charging duration ↑,
//                                charging efficiency ↓, failed charging ↑
//   6.3 Connectivity degradation connection drops ↑, reconnects ↑, latency ↑,
//                                communication errors ↑
//   6.4 Station performance      swap success ↓, charging duration ↑,
//                                error events ↑, station throughput ↓

export type ScenarioCode = "cooling" | "charging" | "connectivity" | "station_performance";

export interface Scenario {
  code: ScenarioCode;
  label: string;
  /** Spec section that defines it, shown as provenance in the UI. */
  section: string;
}

export const SCENARIOS: Record<ScenarioCode, Scenario> = {
  cooling: { code: "cooling", label: "Cooling degradation", section: "6.1" },
  charging: { code: "charging", label: "Charging subsystem degradation", section: "6.2" },
  connectivity: { code: "connectivity", label: "Connectivity degradation", section: "6.3" },
  station_performance: {
    code: "station_performance",
    label: "Station performance degradation",
    section: "6.4",
  },
};

export const SCENARIO_ORDER: ScenarioCode[] = [
  "cooling",
  "charging",
  "connectivity",
  "station_performance",
];

/**
 * Signal-to-scenario rules, most specific first.
 *
 * Several signals appear under more than one scenario in the spec (charging
 * duration is listed under 6.1, 6.2 and 6.4). Each is attributed to the
 * scenario where it is the *defining* symptom, so a signal is never
 * double-counted: temperature is what distinguishes cooling, efficiency and
 * cell balance distinguish the charging subsystem, and swap/throughput
 * distinguish station performance.
 */
const RULES: [RegExp, ScenarioCode][] = [
  [/thermal|temperature|overheat|cooling/i, "cooling"],
  [/swap|throughput|dock|station/i, "station_performance"],
  [/connect|communicat|telemetry|offline|latency|reconnect|signal loss/i, "connectivity"],
  [/efficien|cell|imbalance|balance|capacity|state of health|\bsoh\b|voltage|current|charg/i, "charging"],
  [/error|fault/i, "station_performance"],
];

export function scenarioForSignal(signal: string): ScenarioCode {
  for (const [pattern, code] of RULES) {
    if (pattern.test(signal)) return code;
  }
  // Charging is the broadest subsystem, so it is the least-wrong default.
  return "charging";
}

export interface ScenarioBreakdown {
  code: ScenarioCode;
  label: string;
  section: string;
  count: number;
  pct: number;
  /** The raw platform signals rolled into this scenario. */
  signals: string[];
}

/**
 * Rolls raw failure reasons up into the four scenarios. Scenarios with no
 * matching signal are still returned with a zero count, so the panel shows the
 * full scenario set rather than only whatever happens to be firing.
 */
export function rollUpToScenarios(
  reasons: { reason: string; count: number; pct: number }[],
): ScenarioBreakdown[] {
  const buckets = new Map<ScenarioCode, { count: number; signals: string[] }>(
    SCENARIO_ORDER.map((code) => [code, { count: 0, signals: [] }]),
  );

  reasons.forEach((reason) => {
    const code = scenarioForSignal(reason.reason);
    const bucket = buckets.get(code)!;
    bucket.count += reason.count;
    bucket.signals.push(reason.reason);
  });

  const total = [...buckets.values()].reduce((sum, b) => sum + b.count, 0);

  return SCENARIO_ORDER.map((code) => {
    const bucket = buckets.get(code)!;
    return {
      code,
      label: SCENARIOS[code].label,
      section: SCENARIOS[code].section,
      count: bucket.count,
      pct: total > 0 ? Math.round((bucket.count / total) * 1000) / 10 : 0,
      signals: bucket.signals,
    };
  }).sort((a, b) => b.count - a.count);
}
