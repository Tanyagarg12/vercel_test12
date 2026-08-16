"""POC-06 Recommendation Engine.

Converts a predictive risk assessment into an actionable field
recommendation. Only assets at Moderate risk or above get a
recommendation — a Low risk asset has nothing actionable to suggest.
"""

from dataclasses import dataclass

from app.core.logging import get_logger
from app.services.risk_engine import RiskResult
from app.services.scenarios import SCENARIOS

logger = get_logger("recommendation_engine")

INTERVENTION_HOURS_BY_PRIORITY = {"P1": 12, "P2": 48, "P3": 168}
GENERIC_CHECKS = [
    "Review recent telemetry trend",
    "Inspect asset on next scheduled visit",
]


@dataclass
class RecommendationResult:
    priority: str
    recommended_intervention_hours: int
    likely_issue: str
    suggested_checks: list[str]


def compute_recommendation(risk: RiskResult) -> RecommendationResult | None:
    if risk.category == "Low":
        return None

    if risk.scenario_key and risk.scenario_key in SCENARIOS:
        checks = SCENARIOS[risk.scenario_key].suggested_checks
    else:
        checks = GENERIC_CHECKS

    result = RecommendationResult(
        priority=risk.priority,
        recommended_intervention_hours=INTERVENTION_HOURS_BY_PRIORITY[risk.priority],
        likely_issue=risk.likely_issue,
        suggested_checks=checks,
    )
    logger.debug(
        "recommendation_engine/compute_recommendation - end",
        extra={"params": {"priority": result.priority, "likely_issue": result.likely_issue}},
    )
    return result
