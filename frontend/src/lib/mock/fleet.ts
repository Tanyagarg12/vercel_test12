// POC-01 Data Generator — builds the deterministic demo fleet:
// Stations -> Chargers -> Batteries, then scores every battery through the
// Health / Anomaly / Predictive Risk / Recommendation engines.
//
// Two independent things degrade a battery, and keeping them separate is
// what makes the dashboard behave like a real fleet:
//
//   wear        gradual capacity fade / ageing. Lowers HEALTH (current
//               condition) but is stable, so it does NOT raise predictive
//               risk — a worn but steady pack needs replacement planning,
//               not an emergency callout.
//   activeFault an in-progress degradation ramp. Produces the anomaly
//               signals that drive PREDICTIVE RISK and a recommended
//               field action.
//
// That is why ~20% of the fleet sits below the healthy band while only a
// few percent carry real predicted-failure risk.
//
// The generator is seeded, so the fleet is identical on every load and
// after every demo reset (spec section 20 — deterministic scenarios).

import {
  computeAnomaly,
  computeHealth,
  computeRecommendation,
  computeRisk,
  signalsForMode,
  type AnomalyResult,
  type HealthResult,
  type RecommendationResult,
  type RiskResult,
} from "./engine";
import { FAILURE_MODES, pickWeightedMode, type FailureModeKey, type Severity } from "./failureModes";
import { clamp, mulberry32 } from "./rng";

const DEMO_SEED = 20250520;

export const FLEET_SIZE = {
  stations: 248,
  chargers: 1456,
  batteries: 12320,
};

/** Exact counts of unreachable / faulty equipment. These are picked by
 * count rather than by per-item probability so the availability KPIs land
 * on the documented operating profile every run instead of drifting with
 * the random draw. */
const AVAILABILITY = {
  stationsOffline: 22,
  chargersFaulty: 144,
  batteriesOffline: 1080,
};

/** Wear bands — chosen so the resulting health distribution matches the
 * documented fleet profile (~80% healthy / ~15% warning / ~5% critical).
 * `skew` biases where in the band a value lands: >1 pulls toward `min`,
 * which reflects that most in-service packs are far from end-of-life. */
const WEAR_BANDS = [
  { share: 0.796, min: 0.0, max: 0.55, skew: 1.8 },
  { share: 0.153, min: 0.55, max: 0.85, skew: 1 },
  { share: 0.051, min: 0.85, max: 1.0, skew: 1 },
];

/** Active-fault bands — chosen so predictive risk lands on the documented
 * profile (~0.6% critical / ~1.8% high / ~4.3% moderate). */
const FAULT_BANDS = [
  { share: 0.01, min: 0.66, max: 0.86 },
  { share: 0.022, min: 0.45, max: 0.64 },
  { share: 0.043, min: 0.18, max: 0.42 },
];
const FAULT_FREE_SHARE = 1 - FAULT_BANDS.reduce((sum, b) => sum + b.share, 0);

/** The demo's hero scenario (spec section 15): one battery is always in
 * mid-ramp thermal degradation at a known station, so the end-to-end
 * story — detect, score, explain, recommend — is reproducible every run. */
// Its fault effect sits above every band's maximum, so the hero is genuinely
// the most anomalous pack in the fleet and reliably tops the risk register.
const HERO = {
  batteryId: "BAT-10234",
  stationId: "ST-0456",
  city: "Delhi",
  failureMode: "high_temperature" as FailureModeKey,
  faultEffect: 0.95,
  wear: 0.9,
};
const BATTERY_SERIAL_START = 9001;
const HERO_BATTERY_INDEX = Number(HERO.batteryId.slice(4)) - BATTERY_SERIAL_START;

/** The demo's hero pack, exported so the copilot can resolve the
 * requirements document's worked example onto it. */
export const HERO_BATTERY_ID = HERO.batteryId;
export const HERO_STATION_ID = HERO.stationId;

export interface City {
  name: string;
  lat: number;
  lng: number;
}

export const CITIES: City[] = [
  { name: "Delhi", lat: 28.7041, lng: 77.1025 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
];

export interface Station {
  stationId: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  status: "ONLINE" | "OFFLINE";
  chargerIds: string[];
  batteryIds: string[];
  healthScore: number;
  throughputPerDay: number;
}

export interface Charger {
  chargerId: string;
  stationId: string;
  city: string;
  status: "ONLINE" | "FAULTY";
  bays: number;
  utilizationPct: number;
  lastServiceDays: number;
}

export interface Battery {
  batteryId: string;
  stationId: string;
  chargerId: string;
  city: string;
  /** "ST-0456 Delhi" — the label format used in the alert and risk panels. */
  stationLabel: string;
  status: "ACTIVE" | "OFFLINE";
  failureMode: FailureModeKey | null;
  severity: Severity | null;
  wear: number;
  soh: number;
  cycleCount: number;
  capacityKwh: number;
  health: HealthResult;
  anomaly: AnomalyResult;
  risk: RiskResult;
  recommendation: RecommendationResult | null;
  lastSeenMinutesAgo: number;
}

export interface Fleet {
  stations: Station[];
  chargers: Charger[];
  batteries: Battery[];
  stationsById: Map<string, Station>;
  chargersById: Map<string, Charger>;
  batteriesById: Map<string, Battery>;
}

/**
 * Pick a value from a set of probability bands.
 *
 * `offset` is the share of the population that falls into none of the bands
 * (used for the fault bands, where most batteries have no active fault) —
 * a roll below it returns 0. Both random draws happen unconditionally so
 * every battery consumes the same amount of the seeded stream.
 */
function sampleBand(
  rng: () => number,
  bands: { share: number; min: number; max: number; skew?: number }[],
  offset = 0,
): number {
  const roll = rng();
  const position = rng();
  if (roll < offset) return 0;

  let cursor = offset;
  for (const band of bands) {
    cursor += band.share;
    if (roll <= cursor) {
      const placed = band.skew && band.skew !== 1 ? Math.pow(position, band.skew) : position;
      return band.min + placed * (band.max - band.min);
    }
  }
  return 0;
}

/** Choose exactly `count` indices out of `total`, never picking `exclude`. */
function pickExact(rng: () => number, total: number, count: number, exclude?: number): Set<number> {
  const pool = shuffle(
    Array.from({ length: total }, (_, i) => i).filter((i) => i !== exclude),
    rng,
  );
  return new Set(pool.slice(0, count));
}

function severityForEffect(effect: number): Severity | null {
  if (effect <= 0) return null;
  if (effect < 0.45) return "LOW";
  if (effect < 0.75) return "MEDIUM";
  return "HIGH";
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildFleet(): Fleet {
  const rng = mulberry32(DEMO_SEED);

  // Station IDs are 3-digit values zero-padded to 4 (ST-0456); charger and
  // battery serials run sequentially (CH-0789, BAT-10234).
  const heroNumber = Number(HERO.stationId.slice(3));
  const heroStationIndex = (HERO_BATTERY_INDEX % FLEET_SIZE.chargers) % FLEET_SIZE.stations;
  const stationNumbers = shuffle(
    Array.from({ length: 900 }, (_, i) => i + 100).filter((n) => n !== heroNumber),
    rng,
  ).slice(0, FLEET_SIZE.stations);
  stationNumbers[heroStationIndex] = heroNumber;

  const offlineStations = pickExact(rng, FLEET_SIZE.stations, AVAILABILITY.stationsOffline, heroStationIndex);
  const faultyChargers = pickExact(rng, FLEET_SIZE.chargers, AVAILABILITY.chargersFaulty);
  const offlineBatteries = pickExact(
    rng,
    FLEET_SIZE.batteries,
    AVAILABILITY.batteriesOffline,
    HERO_BATTERY_INDEX,
  );

  const stations: Station[] = stationNumbers.map((number, idx) => {
    const isHero = idx === heroStationIndex;
    const city = isHero ? CITIES.find((c) => c.name === HERO.city)! : CITIES[idx % CITIES.length];
    return {
      stationId: `ST-${String(number).padStart(4, "0")}`,
      name: `${city.name} Swap Hub ${Math.floor(idx / CITIES.length) + 1}`,
      city: city.name,
      // Spread stations across a wide metro catchment so the network map
      // reads as a distribution rather than eight overlapping dots.
      lat: city.lat + (rng() - 0.5) * 1.6,
      lng: city.lng + (rng() - 0.5) * 1.6,
      status: offlineStations.has(idx) ? "OFFLINE" : "ONLINE",
      chargerIds: [],
      batteryIds: [],
      healthScore: 0,
      throughputPerDay: Math.round(40 + rng() * 110),
    };
  });
  const stationsById = new Map(stations.map((s) => [s.stationId, s]));

  const chargers: Charger[] = Array.from({ length: FLEET_SIZE.chargers }, (_, idx) => {
    const station = stations[idx % stations.length];
    const chargerId = `CH-${String(idx + 1).padStart(4, "0")}`;
    station.chargerIds.push(chargerId);
    return {
      chargerId,
      stationId: station.stationId,
      city: station.city,
      status: faultyChargers.has(idx) ? "FAULTY" : "ONLINE",
      bays: 4 + Math.floor(rng() * 5),
      utilizationPct: Math.round(35 + rng() * 60),
      lastServiceDays: Math.floor(rng() * 180),
    };
  });
  const chargersById = new Map(chargers.map((c) => [c.chargerId, c]));

  const batteries: Battery[] = Array.from({ length: FLEET_SIZE.batteries }, (_, idx) => {
    const charger = chargers[idx % chargers.length];
    const station = stationsById.get(charger.stationId)!;
    const batteryId = `BAT-${String(BATTERY_SERIAL_START + idx).padStart(5, "0")}`;
    station.batteryIds.push(batteryId);

    const isHero = idx === HERO_BATTERY_INDEX;
    const isOffline = offlineBatteries.has(idx);
    const wear = isHero ? HERO.wear : sampleBand(rng, WEAR_BANDS);
    const faultEffect = isHero ? HERO.faultEffect : sampleBand(rng, FAULT_BANDS, FAULT_FREE_SHARE);
    const severity = severityForEffect(faultEffect);
    const failureMode = isHero ? HERO.failureMode : severity ? pickWeightedMode(rng()) : null;
    const signals = signalsForMode(failureMode, faultEffect);

    const health = computeHealth(signals, wear, rng());
    const anomaly = computeAnomaly(signals, 0.92 + rng() * 0.16);
    const risk = computeRisk(health, anomaly, signals);
    const recommendation = computeRecommendation(risk);

    return {
      batteryId,
      stationId: station.stationId,
      chargerId: charger.chargerId,
      city: station.city,
      stationLabel: `${station.stationId} ${station.city}`,
      status: isOffline ? "OFFLINE" : "ACTIVE",
      failureMode,
      severity,
      wear: Math.round(wear * 100) / 100,
      soh: Math.round(clamp(100 - wear * 24 - rng() * 2, 58, 100) * 10) / 10,
      cycleCount: Math.round(180 + wear * 1500 + rng() * 220),
      capacityKwh: 3.9,
      health,
      anomaly,
      risk,
      recommendation,
      lastSeenMinutesAgo: isOffline ? 30 + Math.floor(rng() * 600) : Math.floor(rng() * 5),
    };
  });
  const batteriesById = new Map(batteries.map((b) => [b.batteryId, b]));

  // A station's health is the mean health of the batteries it holds.
  stations.forEach((station) => {
    const scores = station.batteryIds.map((id) => batteriesById.get(id)!.health.score);
    station.healthScore = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : 0;
  });

  return { stations, chargers, batteries, stationsById, chargersById, batteriesById };
}

let cached: Fleet | null = null;

export function getFleet(): Fleet {
  if (!cached) cached = buildFleet();
  return cached;
}

export function getBattery(batteryId: string): Battery | undefined {
  return getFleet().batteriesById.get(batteryId);
}

export function getStation(stationId: string): Station | undefined {
  return getFleet().stationsById.get(stationId);
}

export function failureModeOf(battery: Battery) {
  return battery.failureMode ? FAILURE_MODES[battery.failureMode] : null;
}
