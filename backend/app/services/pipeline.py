"""Orchestrates the scoring pipeline for a single asset:

Telemetry -> Health Engine + Anomaly Engine -> Predictive Risk Engine ->
Recommendation Engine -> persisted snapshots.

Also builds the short history (daily health snapshots, recent anomaly
events) the dashboard's trend charts and event feeds read from.
"""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.scoring import AnomalyEvent, DailyHealthSnapshot, HealthScore, Recommendation, RiskAssessment
from app.models.telemetry import Telemetry
from app.services.anomaly_engine import compute_anomaly
from app.services.health_engine import compute_health
from app.services.recommendation_engine import compute_recommendation
from app.services.risk_engine import compute_risk

logger = get_logger("pipeline")

DAILY_SNAPSHOT_DAYS = 14
ANOMALY_EVENT_LOOKBACK_DAYS = 7
ANOMALY_EVENT_THRESHOLD = 30.0


def score_asset(db: Session, asset_id: str, telemetry: list[Telemetry], as_of: datetime) -> None:
    logger.debug("pipeline/score_asset - start", extra={"params": {"asset_id": asset_id}})

    health = compute_health(telemetry, as_of)
    anomaly = compute_anomaly(telemetry, as_of)
    risk = compute_risk(health, anomaly)
    recommendation = compute_recommendation(risk)

    db.merge(
        HealthScore(
            asset_id=asset_id,
            score=health.score,
            classification=health.classification,
            temperature_score=health.temperature_score,
            charging_score=health.charging_score,
            electrical_score=health.electrical_score,
            connectivity_score=health.connectivity_score,
            operational_score=health.operational_score,
            updated_at=as_of,
        )
    )
    db.merge(
        RiskAssessment(
            asset_id=asset_id,
            risk_percent=risk.risk_percent,
            category=risk.category,
            prediction_window_hours=risk.prediction_window_hours,
            likely_issue=risk.likely_issue,
            priority=risk.priority,
            explanation=risk.explanation,
            updated_at=as_of,
        )
    )

    db.query(Recommendation).filter(Recommendation.asset_id == asset_id).delete()
    if recommendation:
        db.add(
            Recommendation(
                asset_id=asset_id,
                priority=recommendation.priority,
                recommended_intervention_hours=recommendation.recommended_intervention_hours,
                likely_issue=recommendation.likely_issue,
                suggested_checks=recommendation.suggested_checks,
                updated_at=as_of,
            )
        )

    _build_daily_snapshots(db, asset_id, telemetry, as_of)
    _build_anomaly_events(db, asset_id, telemetry, as_of)

    logger.debug(
        "pipeline/score_asset - end",
        extra={
            "params": {
                "asset_id": asset_id,
                "health": health.score,
                "anomaly": anomaly.score,
                "risk": risk.risk_percent,
            }
        },
    )


def _build_daily_snapshots(db: Session, asset_id: str, telemetry: list[Telemetry], as_of: datetime) -> None:
    db.query(DailyHealthSnapshot).filter(DailyHealthSnapshot.asset_id == asset_id).delete()
    for day_offset in range(DAILY_SNAPSHOT_DAYS - 1, -1, -1):
        snapshot_time = as_of - timedelta(days=day_offset)
        rows_up_to_day = [r for r in telemetry if r.timestamp <= snapshot_time]
        if not rows_up_to_day:
            continue
        health = compute_health(rows_up_to_day, snapshot_time)
        db.add(
            DailyHealthSnapshot(
                asset_id=asset_id,
                day=snapshot_time.date(),
                score=health.score,
                classification=health.classification,
            )
        )


def _build_anomaly_events(db: Session, asset_id: str, telemetry: list[Telemetry], as_of: datetime) -> None:
    db.query(AnomalyEvent).filter(AnomalyEvent.asset_id == asset_id).delete()
    for day_offset in range(ANOMALY_EVENT_LOOKBACK_DAYS - 1, -1, -1):
        event_time = as_of - timedelta(days=day_offset)
        rows_up_to_day = [r for r in telemetry if r.timestamp <= event_time]
        if not rows_up_to_day:
            continue
        anomaly = compute_anomaly(rows_up_to_day, event_time)
        if anomaly.score >= ANOMALY_EVENT_THRESHOLD:
            db.add(
                AnomalyEvent(
                    asset_id=asset_id,
                    timestamp=event_time,
                    anomaly_score=anomaly.score,
                    severity=anomaly.severity,
                    detected_signals=anomaly.detected_signals,
                )
            )
