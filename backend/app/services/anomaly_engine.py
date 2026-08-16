"""POC-04 Anomaly Detection Engine.

Detects behaviour that deviates from an asset's own recent baseline, even
when no single parameter has crossed a hard threshold (spec section 8):
combines several independent signals — thermal, charging, electrical,
connectivity, swap-failure — into one score, so a moderate shift in
several signals at once reads as clearly abnormal even though none alone
would trigger a static alert. Signals are combined with a noisy-OR
(1 - product(1 - signal)) rather than a plain sum so the score saturates
gracefully instead of one runaway metric alone forcing a flat 100.
"""

from dataclasses import dataclass, field
from datetime import datetime
from statistics import fmean, pstdev

from app.core.logging import get_logger
from app.models.telemetry import Telemetry
from app.services.metrics import connectivity_fractions, failed_swap_rate, mean_std, window_slice, zscore

logger = get_logger("anomaly_engine")

RECENT_WINDOW_HOURS = 24
# Baseline is drawn from 7-21 days back rather than the days immediately
# preceding "now" — failure scenarios ramp in over up to 7 days, so a
# baseline window that reached into that period would be partly
# contaminated by the very degradation it's meant to detect against.
BASELINE_WINDOW_HOURS = 24 * 14
BASELINE_OFFSET_HOURS = 24 * 7

Z_SATURATION = 10.0

SIGNAL_LABELS = {
    "temperature": "Temperature increasing",
    "charging_duration": "Charging duration increasing",
    "current": "Current variability increasing",
    "connectivity": "Connectivity degrading",
    "swap_failure": "Failed swap rate increasing",
}
SIGNAL_DETECTION_THRESHOLD = 0.25

SEVERITY_THRESHOLDS = [(70, "HIGH"), (40, "MEDIUM"), (0, "LOW")]


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _severity(score: float) -> str:
    for threshold, label in SEVERITY_THRESHOLDS:
        if score >= threshold:
            return label
    return "LOW"


@dataclass
class AnomalyResult:
    score: float
    severity: str
    detected_signals: list[str] = field(default_factory=list)
    signal_zscores: dict[str, float] = field(default_factory=dict)
    signal_strengths: dict[str, float] = field(default_factory=dict)


def compute_anomaly(telemetry: list[Telemetry], as_of: datetime) -> AnomalyResult:
    recent = window_slice(telemetry, as_of, RECENT_WINDOW_HOURS)
    baseline = window_slice(
        telemetry, as_of, BASELINE_WINDOW_HOURS, offset_hours=BASELINE_OFFSET_HOURS
    )

    if not recent or not baseline:
        return AnomalyResult(score=0.0, severity="LOW")

    zscores: dict[str, float] = {}
    for metric in ("temperature", "charging_duration", "current"):
        recent_mean = fmean(getattr(r, metric) for r in recent)
        baseline_mean, baseline_std = mean_std([getattr(r, metric) for r in baseline], metric)
        zscores[metric] = zscore(recent_mean, baseline_mean, baseline_std)

    signals = {metric: _clamp01(max(0.0, z) / Z_SATURATION) for metric, z in zscores.items()}

    # Charging-subsystem degradation shows up as increased current *volatility*
    # rather than a mean shift, so track a variance-ratio signal alongside the
    # mean-based z-score and fold the stronger of the two in.
    recent_current_std = pstdev(r.current for r in recent) if len(recent) > 1 else 0.0
    _, baseline_current_std = mean_std([r.current for r in baseline], "current")
    variance_ratio_signal = _clamp01((recent_current_std / baseline_current_std - 1) / 2)
    signals["current"] = 1 - (1 - signals["current"]) * (1 - variance_ratio_signal)

    recent_stable, _, recent_offline = connectivity_fractions(recent)
    baseline_stable, _, _ = connectivity_fractions(baseline)
    connectivity_drift = (1 - recent_stable) - (1 - baseline_stable)
    signals["connectivity"] = _clamp01(connectivity_drift * 1.5 + recent_offline * 2)

    recent_fail_rate = failed_swap_rate(recent)
    baseline_fail_rate = failed_swap_rate(baseline)
    signals["swap_failure"] = _clamp01((recent_fail_rate - baseline_fail_rate) * 4)

    combined = 1.0
    for strength in signals.values():
        combined *= 1 - strength
    score = round((1 - combined) * 100, 1)

    detected_signals = [
        SIGNAL_LABELS[key] for key, strength in signals.items() if strength >= SIGNAL_DETECTION_THRESHOLD
    ]

    result = AnomalyResult(
        score=score,
        severity=_severity(score),
        detected_signals=detected_signals,
        signal_zscores={k: round(v, 2) for k, v in zscores.items()},
        signal_strengths={k: round(v, 2) for k, v in signals.items()},
    )
    logger.debug(
        "anomaly_engine/compute_anomaly - end",
        extra={"params": {"score": result.score, "severity": result.severity}},
    )
    return result
