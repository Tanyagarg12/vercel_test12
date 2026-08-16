// POC-03..06 — Asset Health, Anomaly Detection, Predictive Risk and
// Recommendation engines.
//
// Signals are combined with a noisy-OR (1 - product(1 - signal)) rather than
// a sum, so several moderate signals together read as clearly abnormal
// without any one runaway metric pinning the score at 100 — that is the
// behaviour spec section 8 asks for ("identify anomalies even when
// individual parameters have not crossed a hard threshold").

import { FAILURE_MODES, SEVERITY_INTENSITY, type FailureModeKey, type Severity } from "./failureModes";
import { clamp, clamp01 } from "./rng";

/** Health classification bands (configurable per spec section 7.2). */
export const HEALTH_BANDS = [
  { min: 70, label: "Healthy" as const },
  { min: 40, label: "Warning" as const },
  { min: 0, label: "Critical" as const },
];

export type HealthClassification = "Healthy" | "Warning" | "Critical";
export type RiskCategory = "Low" | "Moderate" | "High" | "Critical";
export type Priority = "P1" | "P2" | "P3";
export type Impact = "Low" | "Medium" | "High";

/** Health dimension weights (configurable per spec section 7.1). */
export const HEALTH_WEIGHTS = {
  temperature: 0.25,
  charging: 0.25,
  electrical: 0.2,
  connectivity: 0.1,
  operational: 0.2,
};

/** Predictive risk category thresholds (configurable per spec section 9.2). */
export const RISK_BANDS = [
  { min: 81, label: "Critical" as const },
  { min: 61, label: "High" as const },
  { min: 31, label: "Moderate" as const },
  { min: 0, label: "Low" as const },
];

export interface Signals {
  temperature: number;
  cellImbalance: number;
  voltage: number;
  current: number;
  connectivity: number;
  charging: number;
}

const EMPTY_SIGNALS: Signals = {
  temperature: 0,
  cellImbalance: 0,
  voltage: 0,
  current: 0,
  connectivity: 0,
  charging: 0,
};

export interface HealthResult {
  score: number;
  classification: HealthClassification;
  dimensions: {
    temperature: number;
    charging: number;
    electrical: number;
    connectivity: number;
    operational: number;
  };
}

export interface AnomalyResult {
  score: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
  detectedSignals: string[];
}

export interface RiskResult {
  percent: number;
  category: RiskCategory;
  modeKey: FailureModeKey | null;
  reason: string;
  likelyIssue: string;
  priority: Priority;
  impact: Impact;
  predictionWindowHours: number;
  failureInHours: number | null;
  explanation: string;
}

export interface RecommendationResult {
  priority: Priority;
  interventionHours: number;
  likelyIssue: string;
  suggestedChecks: string[];
}

export function classifyHealth(score: number): HealthClassification {
  return HEALTH_BANDS.find((band) => score >= band.min)?.label ?? "Critical";
}

export function categorizeRisk(percent: number): RiskCategory {
  return RISK_BANDS.find((band) => percent >= band.min)?.label ?? "Low";
}

const PRIORITY_IMPACT: Record<RiskCategory, [Priority, Impact]> = {
  Critical: ["P1", "High"],
  High: ["P1", "High"],
  Moderate: ["P2", "Medium"],
  Low: ["P3", "Low"],
};

const INTERVENTION_HOURS: Record<Priority, number> = { P1: 12, P2: 48, P3: 168 };

/** Raw signal strengths (0-1) a failure mode produces at a given ramp effect. */
export function signalsForMode(mode: FailureModeKey | null, effect: number): Signals {
  if (!mode || effect <= 0) return { ...EMPTY_SIGNALS };
  switch (mode) {
    case "high_temperature":
      return { ...EMPTY_SIGNALS, temperature: effect, charging: 0.45 * effect, current: 0.25 * effect };
    case "cell_imbalance":
      return { ...EMPTY_SIGNALS, cellImbalance: effect, charging: 0.4 * effect, voltage: 0.2 * effect };
    case "over_voltage":
      return { ...EMPTY_SIGNALS, voltage: effect, charging: 0.3 * effect };
    case "communication_loss":
      return { ...EMPTY_SIGNALS, connectivity: effect };
    case "over_current":
      return { ...EMPTY_SIGNALS, current: effect, charging: 0.35 * effect };
  }
}

const SIGNAL_LABELS: Record<keyof Signals, string> = {
  temperature: "Temperature increasing",
  cellImbalance: "Cell voltage delta increasing",
  voltage: "Pack voltage above nominal",
  current: "Current variability increasing",
  connectivity: "Telemetry drops increasing",
  charging: "Charging duration increasing",
};

const DETECTION_THRESHOLD = 0.25;

export function computeAnomaly(signals: Signals, jitter: number): AnomalyResult {
  let combined = 1;
  const strengths: Partial<Record<keyof Signals, number>> = {};
  (Object.keys(signals) as (keyof Signals)[]).forEach((key) => {
    const strength = clamp01(signals[key] * jitter);
    strengths[key] = strength;
    combined *= 1 - strength;
  });

  const score = Math.round((1 - combined) * 1000) / 10;
  const detectedSignals = (Object.keys(strengths) as (keyof Signals)[])
    .filter((key) => (strengths[key] ?? 0) >= DETECTION_THRESHOLD)
    .map((key) => SIGNAL_LABELS[key]);

  return {
    score,
    severity: score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW",
    detectedSignals,
  };
}

/** How a pack's accumulated wear is felt across the health dimensions.
 * Capacity fade shows up most in electrical behaviour and charging
 * performance; connectivity is unaffected by ageing. */
const WEAR_PROFILE = {
  temperature: 0.8,
  charging: 1.3,
  electrical: 1.5,
  connectivity: 0,
  operational: 1.2,
};
/** Score drop at wear = 1, spread over the profile above. */
const WEAR_MAX_DROP = 74;
const WEAR_CURVE = 1.5;

const WEAR_NORMALISER = Object.entries(WEAR_PROFILE).reduce(
  (sum, [dim, factor]) => sum + factor * HEALTH_WEIGHTS[dim as keyof typeof HEALTH_WEIGHTS],
  0,
);

/**
 * @param signals  active-fault signal strengths (0-1)
 * @param wear     accumulated ageing / capacity fade (0-1)
 */
export function computeHealth(signals: Signals, wear: number, jitter: number): HealthResult {
  const wearDrop = (WEAR_MAX_DROP * Math.pow(clamp01(wear), WEAR_CURVE)) / WEAR_NORMALISER;

  const avgTemp = 31 + signals.temperature * 11 + (jitter - 0.5) * 1.4;
  const avgCharge = 70 + signals.charging * 22 + (jitter - 0.5) * 3;
  const currentStd = 0.4 * (1 + signals.current * 3.5);
  const cellDeltaMv = 12 + signals.cellImbalance * 95;
  const voltageExcess = signals.voltage * 3.2;
  const worstSignal = Math.max(...Object.values(signals));

  const temperature = clamp(
    100 - Math.max(0, avgTemp - 34) * 7.5 - wearDrop * WEAR_PROFILE.temperature,
    0,
    100,
  );
  const charging = clamp(
    100 - Math.max(0, avgCharge - 75) * 3 - wearDrop * WEAR_PROFILE.charging,
    0,
    100,
  );
  const electrical = clamp(
    100 -
      Math.max(0, currentStd - 0.5) * 22 -
      Math.max(0, cellDeltaMv - 25) * 0.75 -
      voltageExcess * 12 -
      wearDrop * WEAR_PROFILE.electrical,
    0,
    100,
  );
  const connectivity = clamp(100 - clamp01(signals.connectivity * 0.85) * 100, 0, 100);
  const operational = clamp(
    100 - clamp01(worstSignal * 0.55) * 100 - wearDrop * WEAR_PROFILE.operational,
    0,
    100,
  );

  const score =
    temperature * HEALTH_WEIGHTS.temperature +
    charging * HEALTH_WEIGHTS.charging +
    electrical * HEALTH_WEIGHTS.electrical +
    connectivity * HEALTH_WEIGHTS.connectivity +
    operational * HEALTH_WEIGHTS.operational;

  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    score: round1(score),
    classification: classifyHealth(score),
    dimensions: {
      temperature: round1(temperature),
      charging: round1(charging),
      electrical: round1(electrical),
      connectivity: round1(connectivity),
      operational: round1(operational),
    },
  };
}

function modeIndicators(signals: Signals): Record<FailureModeKey, number> {
  return {
    high_temperature: signals.temperature * 1.0 + signals.charging * 0.25,
    cell_imbalance: signals.cellImbalance * 1.0 + signals.charging * 0.2,
    over_voltage: signals.voltage * 1.0 + signals.charging * 0.2,
    communication_loss: signals.connectivity,
    over_current: signals.current * 1.0 + signals.charging * 0.2,
  };
}

const NO_ISSUE_THRESHOLD = 0.15;

/** Hours until the predicted issue is expected to become an incident. */
function estimateFailureInHours(percent: number): number | null {
  if (percent < 61) return null;
  return Math.round(clamp(14 + (91 - percent) * 0.5, 6, 24));
}

export function computeRisk(health: HealthResult, anomaly: AnomalyResult, signals: Signals): RiskResult {
  const indicators = Object.entries(modeIndicators(signals)) as [FailureModeKey, number][];
  const [topKey, topValue] = indicators.reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  const modeKey: FailureModeKey | null = topValue < NO_ISSUE_THRESHOLD ? null : topKey;

  const percent = Math.round(clamp(anomaly.score * 0.75 + (100 - health.score) * 0.4, 0, 99) * 10) / 10;
  const category = categorizeRisk(percent);
  const [priority, impact] = PRIORITY_IMPACT[category];
  const mode = modeKey ? FAILURE_MODES[modeKey] : null;

  const explanation = anomaly.detectedSignals.length
    ? `Over the last 24 hours this battery shows ${anomaly.detectedSignals.join(", ").toLowerCase()}, ` +
      `and overall health has moved to ${health.score}/100 (${health.classification}). This pattern is ` +
      `consistent with early-stage ${(mode?.likelyIssue ?? "degradation").toLowerCase()}. This is a ` +
      `predictive risk assessment based on current trends, not a confirmed failure.`
    : `Telemetry is within normal operating ranges and health is ${health.score}/100 ` +
      `(${health.classification}). No early-warning signals detected in the last 24 hours.`;

  return {
    percent,
    category,
    modeKey,
    reason: mode?.reason ?? "No significant issue",
    likelyIssue: mode?.likelyIssue ?? "No significant issue detected",
    priority,
    impact,
    predictionWindowHours: 48,
    failureInHours: estimateFailureInHours(percent),
    explanation,
  };
}

export function computeRecommendation(risk: RiskResult): RecommendationResult | null {
  if (risk.category === "Low") return null;
  return {
    priority: risk.priority,
    interventionHours: INTERVENTION_HOURS[risk.priority],
    likelyIssue: risk.likelyIssue,
    suggestedChecks: risk.modeKey
      ? FAILURE_MODES[risk.modeKey].suggestedChecks
      : ["Review recent telemetry trend", "Inspect on next scheduled visit"],
  };
}

export function severityEffect(severity: Severity | null): number {
  return severity ? SEVERITY_INTENSITY[severity] : 0;
}
