"""POC-03 Asset Health Engine.

Scores an asset's current condition (0-100) across five weighted
dimensions against the documented normal operating envelope (spec
section 5.3), independent of the asset's own history — this is "how
healthy is it right now", distinct from the Anomaly Engine's "has its
behaviour changed" question.
"""

import statistics
from dataclasses import dataclass
from datetime import datetime

from app.core.logging import get_logger
from app.models.telemetry import Telemetry
from app.services.metrics import connectivity_fractions, error_rate, failed_swap_rate, window_slice

logger = get_logger("health_engine")

DEFAULT_WEIGHTS = {
    "temperature": 0.25,
    "charging": 0.25,
    "electrical": 0.20,
    "connectivity": 0.10,
    "operational": 0.20,
}

CLASSIFICATION_THRESHOLDS = [
    (90, "Healthy"),
    (75, "Normal"),
    (50, "At Risk"),
    (0, "Critical"),
]

RECENT_WINDOW_HOURS = 24


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _temperature_score(rows: list[Telemetry]) -> float:
    if not rows:
        return 100.0
    avg = statistics.fmean(r.temperature for r in rows)
    penalty = max(0.0, avg - 34) * 8 + max(0.0, 28 - avg) * 8
    return _clamp(100 - penalty)


def _charging_score(rows: list[Telemetry]) -> float:
    if not rows:
        return 100.0
    avg = statistics.fmean(r.charging_duration for r in rows)
    penalty = max(0.0, avg - 75) * 3 + max(0.0, 65 - avg) * 3
    return _clamp(100 - penalty)


def _electrical_score(rows: list[Telemetry]) -> float:
    if not rows:
        return 100.0
    currents = [r.current for r in rows]
    avg = statistics.fmean(currents)
    std = statistics.pstdev(currents) if len(currents) > 1 else 0.0
    range_penalty = max(0.0, avg - 11) * 15 + max(0.0, 9 - avg) * 15
    variance_penalty = max(0.0, std - 0.5) * 20
    return _clamp(100 - range_penalty - variance_penalty)


def _connectivity_score(rows: list[Telemetry]) -> float:
    stable_frac, intermittent_frac, offline_frac = connectivity_fractions(rows)
    return _clamp(100 * stable_frac + 55 * intermittent_frac + 15 * offline_frac)


def _operational_score(rows: list[Telemetry]) -> float:
    if not rows:
        return 100.0
    fail_rate = failed_swap_rate(rows)
    err_rate = error_rate(rows)
    penalty = fail_rate * 200 + err_rate * 60
    return _clamp(100 - penalty)


def classify(score: float) -> str:
    for threshold, label in CLASSIFICATION_THRESHOLDS:
        if score >= threshold:
            return label
    return "Critical"


@dataclass
class HealthResult:
    score: float
    classification: str
    temperature_score: float
    charging_score: float
    electrical_score: float
    connectivity_score: float
    operational_score: float


def compute_health(
    telemetry: list[Telemetry],
    as_of: datetime,
    weights: dict[str, float] | None = None,
) -> HealthResult:
    weights = weights or DEFAULT_WEIGHTS
    recent = window_slice(telemetry, as_of, RECENT_WINDOW_HOURS)

    temperature_score = _temperature_score(recent)
    charging_score = _charging_score(recent)
    electrical_score = _electrical_score(recent)
    connectivity_score = _connectivity_score(recent)
    operational_score = _operational_score(recent)

    overall = (
        temperature_score * weights["temperature"]
        + charging_score * weights["charging"]
        + electrical_score * weights["electrical"]
        + connectivity_score * weights["connectivity"]
        + operational_score * weights["operational"]
    )

    result = HealthResult(
        score=round(overall, 1),
        classification=classify(overall),
        temperature_score=round(temperature_score, 1),
        charging_score=round(charging_score, 1),
        electrical_score=round(electrical_score, 1),
        connectivity_score=round(connectivity_score, 1),
        operational_score=round(operational_score, 1),
    )
    logger.debug(
        "health_engine/compute_health - end",
        extra={"params": {"score": result.score, "classification": result.classification}},
    )
    return result
