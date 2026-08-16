// Per-battery hourly telemetry, generated on demand for the Battery 360
// charts. The degradation ramps in gradually across the fault window rather
// than stepping, because the POC is demonstrating early detection
// (spec section 5.3).

import type { Battery } from "./fleet";
import { SEVERITY_INTENSITY } from "./failureModes";
import { gauss, mulberry32, seededHash } from "./rng";

export interface TelemetryPoint {
  timestamp: string;
  temperature: number;
  voltage: number;
  current: number;
  chargingDuration: number;
  cellDeltaMv: number;
  connectivityStatus: "STABLE" | "INTERMITTENT" | "OFFLINE";
}

export interface BatteryEvent {
  timestamp: string;
  label: string;
  severity: "warning" | "critical" | "info";
}

const FAULT_WINDOW_DAYS = 5;

function diurnalOffset(hour: number): number {
  return 1.5 * Math.sin(((hour - 6) / 24) * 2 * Math.PI);
}

/**
 * @param endTime  epoch ms the series ends at. Defaults to now; pass a fixed
 *   value where the output must be identical on the server and the client
 *   (the readings depend on the hour of day, so a wall-clock default would
 *   make a client-rendered series disagree with the server-rendered one).
 */
export function generateTelemetry(battery: Battery, days = 7, endTime = Date.now()): TelemetryPoint[] {
  const rng = mulberry32(seededHash(battery.batteryId));
  const baseTemp = 29 + rng() * 3 + battery.wear * 2;
  const baseCharge = 66 + rng() * 5 + battery.wear * 8;
  const baseCurrent = 9.5 + rng() * 1;
  const baseVoltage = 48 - battery.wear * 1.2;
  const baseCellDelta = 10 + battery.wear * 22;

  const intensity = battery.severity ? SEVERITY_INTENSITY[battery.severity] : 0;
  const totalHours = days * 24;
  const windowStartHour = totalHours - FAULT_WINDOW_DAYS * 24;

  const now = new Date(endTime);
  now.setMinutes(0, 0, 0);

  const points: TelemetryPoint[] = [];
  for (let h = 0; h <= totalHours; h++) {
    const ts = new Date(now.getTime() - (totalHours - h) * 3600_000);
    const rampedHours = h - windowStartHour;
    const effect =
      battery.failureMode && rampedHours > 0
        ? Math.min(1, rampedHours / (FAULT_WINDOW_DAYS * 24)) * intensity
        : 0;

    let tempDelta = 0;
    let chargeDelta = 0;
    let currentNoise = 1;
    let voltageDelta = 0;
    let cellDelta = 0;
    let connectivityStatus: TelemetryPoint["connectivityStatus"] = "STABLE";

    switch (battery.failureMode) {
      case "high_temperature":
        tempDelta = 11 * effect;
        chargeDelta = 18 * effect;
        currentNoise = 1 + 1.4 * effect;
        break;
      case "cell_imbalance":
        cellDelta = 95 * effect;
        chargeDelta = 16 * effect;
        voltageDelta = -0.8 * effect;
        break;
      case "over_voltage":
        voltageDelta = 3.2 * effect;
        chargeDelta = 12 * effect;
        break;
      case "over_current":
        currentNoise = 1 + 3 * effect;
        chargeDelta = 14 * effect;
        break;
      case "communication_loss":
        if (rng() < 0.55 * effect) {
          connectivityStatus = rng() < 0.3 ? "OFFLINE" : "INTERMITTENT";
        }
        break;
    }

    if (battery.status === "OFFLINE" && h >= totalHours - 8) {
      connectivityStatus = "OFFLINE";
    }

    points.push({
      timestamp: ts.toISOString(),
      temperature: Math.round((baseTemp + diurnalOffset(ts.getHours()) + gauss(rng, 0, 0.7) + tempDelta) * 100) / 100,
      voltage: Math.round((baseVoltage + gauss(rng, 0, 0.25) + voltageDelta) * 100) / 100,
      current: Math.round(Math.max(3, baseCurrent + gauss(rng, 0, 0.35 * currentNoise)) * 100) / 100,
      chargingDuration: Math.round(Math.max(30, baseCharge + gauss(rng, 0, 1.8) + chargeDelta) * 10) / 10,
      cellDeltaMv: Math.round(Math.max(2, baseCellDelta + gauss(rng, 0, 3) + cellDelta)),
      connectivityStatus,
    });
  }
  return points;
}

/** Event feed derived from the generated series and the anomaly signals, so
 * it always agrees with the charts shown beside it. */
export function deriveEvents(battery: Battery, data: TelemetryPoint[]): BatteryEvent[] {
  const events: BatteryEvent[] = [];

  data.forEach((point, idx) => {
    const prev = data[idx - 1];
    if (point.connectivityStatus !== "STABLE" && (!prev || prev.connectivityStatus === "STABLE")) {
      events.push({
        timestamp: point.timestamp,
        label: point.connectivityStatus === "OFFLINE" ? "Communication lost" : "Telemetry intermittent",
        severity: point.connectivityStatus === "OFFLINE" ? "critical" : "warning",
      });
    }
  });

  battery.anomaly.detectedSignals.forEach((signal, i) => {
    const point = data[Math.max(0, data.length - 1 - i * 9)];
    if (point) events.push({ timestamp: point.timestamp, label: signal, severity: "warning" });
  });

  if (battery.recommendation) {
    events.push({
      timestamp: data[data.length - 1].timestamp,
      label: `Predictive risk raised to ${battery.risk.percent}% (${battery.risk.category})`,
      severity: "critical",
    });
  }

  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 7);
}
