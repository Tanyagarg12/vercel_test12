"""POC-01 Synthetic Data Generator.

Produces a repeatable network of QIS / swap-station assets and their
telemetry history, with a controlled subset of assets exhibiting gradual
degradation patterns via the Failure Scenario Engine (POC-02). The whole
generator is seeded so the demo dataset is deterministic across resets
(NFR section 20 — "Have deterministic scenarios").
"""

import math
import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.core.logging import get_logger
from app.models.asset import Asset
from app.models.scenario import ScenarioInjection
from app.models.telemetry import Telemetry
from app.services.scenarios import ScenarioInjectionSpec, ramp_fraction

logger = get_logger("generator")

DEMO_SEED = 42
HERO_ASSET_ID = "QIS-128"
OFFLINE_HOURS = 8

_CITIES = [
    ("Bengaluru", 12.9716, 77.5946, "BLR"),
    ("Mumbai", 19.0760, 72.8777, "MUM"),
    ("Delhi", 28.7041, 77.1025, "DEL"),
    ("Pune", 18.5204, 73.8567, "PUN"),
    ("Hyderabad", 17.3850, 78.4867, "HYD"),
    ("Chennai", 13.0827, 80.2707, "CHN"),
]

_ERROR_CODES = {
    "cooling_degradation": "TEMP_HIGH",
    "charging_degradation": "CHG_FAIL",
    "connectivity_degradation": "COMM_ERR",
    "station_performance_degradation": "SWAP_FAIL",
}


@dataclass
class AssetBaseline:
    temperature: float
    charging_duration: float
    current: float
    voltage: float = 48.0


@dataclass
class GeneratedAsset:
    asset: Asset
    baseline: AssetBaseline
    scenario: ScenarioInjectionSpec | None
    scenario_start: datetime | None
    offline: bool = False


def _build_asset_master(rng: random.Random, count: int) -> list[Asset]:
    assets: list[Asset] = []
    city_counters: dict[str, int] = {}
    for i in range(count):
        number = 101 + i
        asset_id = f"QIS-{number}"
        city_name, lat, lon, city_code = _CITIES[i % len(_CITIES)]
        city_counters[city_code] = city_counters.get(city_code, 0) + 1
        station_id = f"{city_code}-{city_counters[city_code]:03d}"
        jitter_lat = lat + rng.uniform(-0.15, 0.15)
        jitter_lon = lon + rng.uniform(-0.15, 0.15)
        install_offset_days = rng.randint(120, 640)
        assets.append(
            Asset(
                asset_id=asset_id,
                station_id=station_id,
                asset_type="QIS",
                location=city_name,
                latitude=round(jitter_lat, 4),
                longitude=round(jitter_lon, 4),
                installation_date=date.today() - timedelta(days=install_offset_days),
                status="ACTIVE",
            )
        )
    return assets


def _assign_scenarios(
    rng: random.Random, assets: list[Asset]
) -> dict[str, ScenarioInjectionSpec]:
    """Assign degradation scenarios to a controlled subset of assets.

    5 assets get HIGH severity (clearly at-risk, drives the Command Center
    "at risk" / "predicted failure" KPIs), 10 get MEDIUM/LOW severity
    (watch-list), the remainder stay normal. QIS-128 is always the HIGH
    severity Cooling Degradation asset used as the demo's hero scenario
    (spec section 6.5 / 15).
    """
    scenario_keys = list(_ERROR_CODES.keys())
    pool = [a.asset_id for a in assets if a.asset_id != HERO_ASSET_ID]
    rng.shuffle(pool)

    assignments: dict[str, ScenarioInjectionSpec] = {
        HERO_ASSET_ID: ScenarioInjectionSpec(
            scenario_key="cooling_degradation",
            severity="HIGH",
            duration_days=5,
            asset_id=HERO_ASSET_ID,
        )
    }

    high_targets = pool[:4]
    for idx, asset_id in enumerate(high_targets):
        assignments[asset_id] = ScenarioInjectionSpec(
            scenario_key=scenario_keys[idx % len(scenario_keys)],
            severity="HIGH",
            duration_days=rng.randint(4, 7),
            asset_id=asset_id,
        )

    watch_targets = pool[4:14]
    for idx, asset_id in enumerate(watch_targets):
        assignments[asset_id] = ScenarioInjectionSpec(
            scenario_key=scenario_keys[idx % len(scenario_keys)],
            severity=rng.choice(["LOW", "MEDIUM"]),
            duration_days=rng.randint(3, 6),
            asset_id=asset_id,
        )

    return assignments


def _assign_offline_assets(rng: random.Random, assets: list[Asset], degrading_ids: set[str]) -> set[str]:
    """A small number of assets are simply offline (no recent connectivity),
    independent of the degradation scenarios, to populate the dashboard's
    Offline KPI with genuine data rather than a hardcoded number."""
    pool = [a.asset_id for a in assets if a.asset_id not in degrading_ids]
    rng.shuffle(pool)
    return set(pool[:4])


def _hourly_timestamps(days: int, end: datetime) -> list[datetime]:
    start = end - timedelta(days=days)
    total_hours = days * 24
    return [start + timedelta(hours=h) for h in range(total_hours + 1)]


def _diurnal_temp_offset(ts: datetime) -> float:
    return 1.5 * math.sin((ts.hour - 6) / 24 * 2 * math.pi)


def _apply_scenario_deltas(
    scenario_key: str, effect: float, rng: random.Random
) -> dict:
    """Return per-hour deltas/flags driven by scenario ramp intensity `effect` (0..1)."""
    deltas = {
        "temperature_delta": 0.0,
        "temperature_noise_mult": 1.0,
        "charging_duration_delta": 0.0,
        "current_noise_mult": 1.0,
        "connectivity_status": "STABLE",
        "error_code": None,
        "failed_swap_bias": 0.0,
        "swap_count_bias": 0.0,
    }
    if effect <= 0:
        return deltas

    if scenario_key == "cooling_degradation":
        deltas["temperature_delta"] = 10 * effect
        deltas["temperature_noise_mult"] = 1 + 2.5 * effect
        deltas["charging_duration_delta"] = 20 * effect
        deltas["current_noise_mult"] = 1 + 1.5 * effect
    elif scenario_key == "charging_degradation":
        deltas["current_noise_mult"] = 1 + 2.5 * effect
        deltas["charging_duration_delta"] = 22 * effect
        deltas["failed_swap_bias"] = 0.35 * effect
    elif scenario_key == "connectivity_degradation":
        deltas["current_noise_mult"] = 1 + 0.5 * effect
        if rng.random() < 0.5 * effect:
            deltas["connectivity_status"] = "OFFLINE" if rng.random() < 0.25 else "INTERMITTENT"
    elif scenario_key == "station_performance_degradation":
        deltas["charging_duration_delta"] = 12 * effect
        deltas["failed_swap_bias"] = 0.45 * effect
        deltas["swap_count_bias"] = -0.4 * effect

    if rng.random() < 0.28 * effect:
        deltas["error_code"] = _ERROR_CODES[scenario_key]

    return deltas


def _generate_telemetry_for_asset(
    rng: random.Random,
    generated: GeneratedAsset,
    timestamps: list[datetime],
) -> list[Telemetry]:
    baseline = generated.baseline
    scenario = generated.scenario
    scenario_start = generated.scenario_start
    total_window_hours = (scenario.duration_days * 24) if scenario else 0

    rows: list[Telemetry] = []
    for ts in timestamps:
        effect = 0.0
        deltas = {
            "temperature_delta": 0.0,
            "temperature_noise_mult": 1.0,
            "charging_duration_delta": 0.0,
            "current_noise_mult": 1.0,
            "connectivity_status": "STABLE",
            "error_code": None,
            "failed_swap_bias": 0.0,
            "swap_count_bias": 0.0,
        }
        if scenario and scenario_start and ts >= scenario_start:
            hours_into = (ts - scenario_start).total_seconds() / 3600
            frac = ramp_fraction(hours_into, total_window_hours)
            effect = frac * scenario.intensity
            deltas = _apply_scenario_deltas(scenario.scenario_key, effect, rng)

        temperature = (
            baseline.temperature
            + _diurnal_temp_offset(ts)
            + rng.gauss(0, 0.8 * deltas["temperature_noise_mult"])
            + deltas["temperature_delta"]
        )
        charging_duration = max(
            30.0,
            baseline.charging_duration
            + rng.gauss(0, 2.0)
            + deltas["charging_duration_delta"],
        )
        current = max(
            4.0,
            baseline.current + rng.gauss(0, 0.4 * deltas["current_noise_mult"]),
        )
        voltage = baseline.voltage + rng.gauss(0, 0.3)

        base_swap_rate = 1.6 + deltas["swap_count_bias"]
        swap_count = max(0, round(rng.gauss(max(base_swap_rate, 0.2), 0.6)))
        failed_swap_count = 0
        if swap_count > 0 and rng.random() < min(0.9, deltas["failed_swap_bias"]):
            failed_swap_count = rng.randint(1, max(1, swap_count // 2))

        operational_status = "NORMAL"
        if effect > 0.75:
            operational_status = "DEGRADED"
        elif effect > 0.4:
            operational_status = "WATCH"

        connectivity_status = deltas["connectivity_status"]
        error_code = deltas["error_code"]
        if generated.offline and ts >= timestamps[-1] - timedelta(hours=OFFLINE_HOURS - 1):
            connectivity_status = "OFFLINE"
            error_code = "COMM_ERR"
            swap_count = 0
            failed_swap_count = 0
            operational_status = "DEGRADED"

        rows.append(
            Telemetry(
                asset_id=generated.asset.asset_id,
                timestamp=ts,
                temperature=round(temperature, 2),
                voltage=round(voltage, 2),
                current=round(current, 2),
                charging_duration=round(charging_duration, 1),
                swap_count=swap_count,
                failed_swap_count=failed_swap_count,
                connectivity_status=connectivity_status,
                error_code=error_code,
                operational_status=operational_status,
            )
        )
    return rows


def reapply_scenario(
    rows: list[Telemetry], scenario: ScenarioInjectionSpec, rng: random.Random | None = None
) -> None:
    """Mutate the tail of an existing telemetry series in place to reflect a
    newly injected scenario, then let the caller re-run scoring. Used by the
    `/demo/scenario` endpoint (spec section 6.5 Scenario Control) so an
    operator-selected scenario actually changes the telemetry pattern rather
    than only being recorded as metadata.
    """
    if not rows:
        return
    rng = rng or random.Random(DEMO_SEED)
    ordered = sorted(rows, key=lambda r: r.timestamp)
    end = ordered[-1].timestamp
    window_start = end - timedelta(days=scenario.duration_days)
    total_window_hours = scenario.duration_days * 24

    for row in ordered:
        if row.timestamp < window_start:
            continue
        hours_into = (row.timestamp - window_start).total_seconds() / 3600
        frac = ramp_fraction(hours_into, total_window_hours)
        effect = frac * scenario.intensity
        deltas = _apply_scenario_deltas(scenario.scenario_key, effect, rng)

        row.temperature = round(
            row.temperature + deltas["temperature_delta"] + rng.gauss(0, 0.3), 2
        )
        row.charging_duration = round(
            max(30.0, row.charging_duration + deltas["charging_duration_delta"]), 1
        )
        if deltas["current_noise_mult"] > 1.0:
            row.current = round(max(4.0, row.current + rng.gauss(0, 0.3 * (deltas["current_noise_mult"] - 1))), 2)
        if deltas["connectivity_status"] != "STABLE":
            row.connectivity_status = deltas["connectivity_status"]
        if deltas["error_code"]:
            row.error_code = deltas["error_code"]
        if rng.random() < deltas["failed_swap_bias"] and row.swap_count > 0:
            row.failed_swap_count = max(row.failed_swap_count, rng.randint(1, max(1, row.swap_count)))


def generate_demo_dataset(
    asset_count: int, history_days: int, now: datetime | None = None
) -> tuple[list[GeneratedAsset], dict[str, list[Telemetry]], list[ScenarioInjection]]:
    """Generate the full asset master + telemetry history for the demo.

    Returns generated asset wrappers, a map of asset_id -> telemetry rows,
    and the scenario injection records to persist for auditability.
    """
    logger.info(
        "generator/generate_demo_dataset - start",
        extra={"params": {"asset_count": asset_count, "history_days": history_days}},
    )
    rng = random.Random(DEMO_SEED)
    now = (now or datetime.utcnow()).replace(minute=0, second=0, microsecond=0)

    assets = _build_asset_master(rng, asset_count)
    scenario_map = _assign_scenarios(rng, assets)
    offline_ids = _assign_offline_assets(rng, assets, set(scenario_map.keys()))
    timestamps = _hourly_timestamps(history_days, now)

    generated_assets: list[GeneratedAsset] = []
    telemetry_by_asset: dict[str, list[Telemetry]] = {}
    scenario_records: list[ScenarioInjection] = []

    for asset in assets:
        baseline = AssetBaseline(
            temperature=rng.uniform(29, 33),
            charging_duration=rng.uniform(67, 73),
            current=rng.uniform(9.5, 10.5),
        )
        scenario = scenario_map.get(asset.asset_id)
        scenario_start = None
        if scenario:
            scenario_start = now - timedelta(days=scenario.duration_days)
            scenario_records.append(
                ScenarioInjection(
                    asset_id=asset.asset_id,
                    scenario_type=scenario.scenario_key,
                    severity=scenario.severity,
                    duration_days=scenario.duration_days,
                )
            )

        is_offline = asset.asset_id in offline_ids
        if is_offline:
            asset.status = "OFFLINE"

        gen = GeneratedAsset(
            asset=asset,
            baseline=baseline,
            scenario=scenario,
            scenario_start=scenario_start,
            offline=is_offline,
        )
        generated_assets.append(gen)
        telemetry_by_asset[asset.asset_id] = _generate_telemetry_for_asset(
            rng, gen, timestamps
        )

    logger.info(
        "generator/generate_demo_dataset - end",
        extra={
            "params": {
                "assets": len(generated_assets),
                "degrading_assets": len(scenario_map),
                "telemetry_rows": sum(len(v) for v in telemetry_by_asset.values()),
            }
        },
    )
    return generated_assets, telemetry_by_asset, scenario_records
