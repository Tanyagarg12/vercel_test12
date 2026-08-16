"""POC-05 Predictive Risk Engine.

Estimates the probability that an asset will experience a defined
operational issue within a future window, from the Health and Anomaly
engine outputs plus telemetry-derived issue signals. Per spec section
9.3, this is explicitly "Predictive Risk / Early Warning" — it must never
be phrased as a confirmed failure prediction.
"""

from dataclasses import dataclass

from app.core.logging import get_logger
from app.services.anomaly_engine import AnomalyResult
from app.services.health_engine import HealthResult
from app.services.scenarios import SCENARIOS

logger = get_logger("risk_engine")

PREDICTION_WINDOW_HOURS = 48

RISK_CATEGORY_THRESHOLDS = [(81, "Critical"), (61, "High"), (31, "Moderate"), (0, "Low")]
NO_ISSUE_THRESHOLD = 0.15


def _category(risk_percent: float) -> str:
    for threshold, label in RISK_CATEGORY_THRESHOLDS:
        if risk_percent >= threshold:
            return label
    return "Low"


def _priority_and_impact(category: str) -> tuple[str, str]:
    mapping = {
        "Critical": ("P1", "High"),
        "High": ("P1", "High"),
        "Moderate": ("P2", "Medium"),
        "Low": ("P3", "Low"),
    }
    return mapping[category]


@dataclass
class RiskResult:
    risk_percent: float
    category: str
    scenario_key: str | None
    likely_issue: str
    priority: str
    impact: str
    prediction_window_hours: int
    explanation: str


def _issue_indicators(anomaly: AnomalyResult) -> dict[str, float]:
    """Which failure scenario the detected signals best match, reusing the
    Anomaly Engine's per-signal strengths (0-1) rather than re-deriving them."""
    s = anomaly.signal_strengths
    temperature = s.get("temperature", 0.0)
    charging = s.get("charging_duration", 0.0)
    current = s.get("current", 0.0)
    connectivity = s.get("connectivity", 0.0)
    swap_failure = s.get("swap_failure", 0.0)

    return {
        "cooling_degradation": temperature * 1.0 + charging * 0.3,
        "charging_degradation": current * 1.0 + charging * 0.5,
        "connectivity_degradation": connectivity,
        "station_performance_degradation": swap_failure * 1.0 + charging * 0.2,
    }


def compute_risk(
    health: HealthResult,
    anomaly: AnomalyResult,
) -> RiskResult:
    indicators = _issue_indicators(anomaly)
    scenario_key, top_indicator = max(indicators.items(), key=lambda kv: kv[1])

    if top_indicator < NO_ISSUE_THRESHOLD:
        scenario_key = None

    risk_percent = min(99.0, anomaly.score * 0.75 + (100 - health.score) * 0.4)
    risk_percent = round(max(0.0, risk_percent), 1)
    category = _category(risk_percent)
    priority, impact = _priority_and_impact(category)

    if scenario_key:
        likely_issue = SCENARIOS[scenario_key].likely_issue
    else:
        likely_issue = "No significant issue detected"

    if anomaly.detected_signals:
        signal_text = ", ".join(anomaly.detected_signals).lower()
        explanation = (
            f"Over the last 24 hours this asset shows {signal_text}, and overall health has "
            f"moved to {health.score}/100 ({health.classification}). This pattern is consistent "
            f"with early-stage {likely_issue.lower()}. This is a predictive risk assessment based "
            f"on current trends, not a confirmed failure."
        )
    else:
        explanation = (
            f"Telemetry is within normal operating ranges and health is {health.score}/100 "
            f"({health.classification}). No early-warning signals detected in the last 24 hours."
        )

    result = RiskResult(
        risk_percent=risk_percent,
        category=category,
        scenario_key=scenario_key,
        likely_issue=likely_issue,
        priority=priority,
        impact=impact,
        prediction_window_hours=PREDICTION_WINDOW_HOURS,
        explanation=explanation,
    )
    logger.debug(
        "risk_engine/compute_risk - end",
        extra={"params": {"risk_percent": result.risk_percent, "category": result.category}},
    )
    return result
