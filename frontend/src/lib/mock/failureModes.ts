// Battery failure modes — the degradation patterns the Failure Scenario
// Engine (POC-02) can inject, expressed in battery-pack terms so the
// dashboard's "Top Failure Reasons" panel reads the way a swap-network
// operations lead would expect.

export type FailureModeKey =
  | "high_temperature"
  | "cell_imbalance"
  | "over_voltage"
  | "communication_loss"
  | "over_current";

export type Severity = "LOW" | "MEDIUM" | "HIGH";

export const SEVERITY_INTENSITY: Record<Severity, number> = {
  LOW: 0.4,
  MEDIUM: 0.7,
  HIGH: 1.0,
};

export interface FailureMode {
  key: FailureModeKey;
  /** Short label used in the Top Failure Reasons panel. */
  reason: string;
  /** Longer phrasing used for "Likely issue" on detail screens. */
  likelyIssue: string;
  alertTitle: string;
  signals: string[];
  suggestedChecks: string[];
  /** Relative prevalence across the fleet. */
  weight: number;
}

export const FAILURE_MODES: Record<FailureModeKey, FailureMode> = {
  high_temperature: {
    key: "high_temperature",
    reason: "High Temperature",
    likelyIssue: "Thermal / cooling degradation",
    alertTitle: "Battery High Temperature",
    signals: [
      "Cell temperature rising",
      "Temperature variance increasing",
      "Charging duration increasing",
    ],
    suggestedChecks: [
      "Inspect cooling path and thermal pads",
      "Check cell temperature sensors",
      "Verify pack ventilation is unobstructed",
      "Review recent charging profile",
      "Check ambient conditions at station",
    ],
    weight: 32,
  },
  cell_imbalance: {
    key: "cell_imbalance",
    reason: "Cell Imbalance",
    likelyIssue: "Cell imbalance / capacity fade",
    alertTitle: "Battery Cell Imbalance",
    signals: [
      "Cell voltage delta increasing",
      "Balancing time increasing",
      "Capacity fade accelerating",
    ],
    suggestedChecks: [
      "Run BMS cell-balance diagnostic",
      "Measure individual cell voltages",
      "Identify weak cell group",
      "Review charge termination behaviour",
      "Inspect BMS harness connections",
    ],
    weight: 24,
  },
  over_voltage: {
    key: "over_voltage",
    reason: "Over Voltage",
    likelyIssue: "Charging over-voltage risk",
    alertTitle: "Charger Over Voltage",
    signals: [
      "Pack voltage above nominal",
      "Charge termination overshoot",
      "Voltage spikes during charge",
    ],
    suggestedChecks: [
      "Verify charger output voltage",
      "Check BMS voltage cut-off threshold",
      "Inspect charger calibration",
      "Review over-voltage protection log",
      "Test pack on an alternate charger bay",
    ],
    weight: 18,
  },
  communication_loss: {
    key: "communication_loss",
    reason: "Communication Loss",
    likelyIssue: "Connectivity / telemetry loss",
    alertTitle: "Communication Lost",
    signals: [
      "Telemetry drops increasing",
      "Reconnect frequency increasing",
      "Heartbeat gaps detected",
    ],
    suggestedChecks: [
      "Inspect battery comms connector",
      "Check station gateway uplink",
      "Verify BMS firmware version",
      "Review communication error log",
      "Test pack on an alternate bay",
    ],
    weight: 14,
  },
  over_current: {
    key: "over_current",
    reason: "Over Current",
    likelyIssue: "Charging over-current risk",
    alertTitle: "Battery Over Current",
    signals: [
      "Charge current above limit",
      "Current spikes increasing",
      "Current variability increasing",
    ],
    suggestedChecks: [
      "Verify charger current limit setting",
      "Inspect power contacts for resistance",
      "Check current sensor calibration",
      "Review over-current protection events",
      "Inspect cabling and connector wear",
    ],
    weight: 12,
  },
};

export const FAILURE_MODE_KEYS = Object.keys(FAILURE_MODES) as FailureModeKey[];

/** Prevalence-weighted pick, so the fleet mix matches the documented reason split. */
export function pickWeightedMode(roll: number): FailureModeKey {
  const total = FAILURE_MODE_KEYS.reduce((sum, k) => sum + FAILURE_MODES[k].weight, 0);
  let cursor = roll * total;
  for (const key of FAILURE_MODE_KEYS) {
    cursor -= FAILURE_MODES[key].weight;
    if (cursor <= 0) return key;
  }
  return FAILURE_MODE_KEYS[0];
}
