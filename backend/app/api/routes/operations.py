from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.asset import Asset
from app.models.scoring import AnomalyEvent, DailyHealthSnapshot, Recommendation, RiskAssessment
from app.schemas.operations import (
    CriticalAlert,
    FailureReason,
    HealthDistributionBucket,
    HealthTrendPoint,
    KPIs,
    OperationsSummary,
    RiskListItem,
    RiskSummary,
)

router = APIRouter(prefix="/operations", tags=["operations"])
logger = get_logger("api.operations")

ALERT_TITLE_BY_ISSUE = {
    "Cooling subsystem degradation": "High Temperature Detected",
    "Charging subsystem risk": "Charging Subsystem Fault",
    "Connectivity risk": "Communication Instability",
    "Station performance degradation": "Station Performance Drop",
}


def _pct(count: int, total: int) -> float:
    return round(100 * count / total, 1) if total else 0.0


@router.get("/summary", response_model=OperationsSummary)
def get_operations_summary(db: Session = Depends(get_db)) -> OperationsSummary:
    logger.info("api.operations/get_operations_summary - start", extra={"params": {}})

    total_assets = db.query(Asset).count()
    offline = db.query(Asset).filter(Asset.status == "OFFLINE").count()

    healthy = (
        db.query(RiskAssessment)
        .join(Asset, Asset.asset_id == RiskAssessment.asset_id)
        .filter(RiskAssessment.category.in_(["Low"]), Asset.status != "OFFLINE")
        .count()
    )
    at_risk = db.query(RiskAssessment).filter(RiskAssessment.category == "Moderate").count()
    critical = db.query(RiskAssessment).filter(RiskAssessment.category.in_(["High", "Critical"])).count()
    predicted_risk = db.query(RiskAssessment).filter(RiskAssessment.category == "Critical").count()
    active_incidents = db.query(Recommendation).count()

    health_buckets = [
        HealthDistributionBucket(label="Healthy", count=healthy, pct=_pct(healthy, total_assets)),
        HealthDistributionBucket(label="Warning", count=at_risk, pct=_pct(at_risk, total_assets)),
        HealthDistributionBucket(label="Critical", count=critical, pct=_pct(critical, total_assets)),
        HealthDistributionBucket(label="Offline", count=offline, pct=_pct(offline, total_assets)),
    ]

    high_risk_assets = db.query(RiskAssessment).filter(RiskAssessment.category.in_(["High", "Critical"])).count()
    maintenance_due = db.query(Recommendation).filter(Recommendation.priority == "P2").count()

    top_risks = (
        db.query(RiskAssessment, Asset)
        .join(Asset, Asset.asset_id == RiskAssessment.asset_id)
        .filter(RiskAssessment.category.in_(["High", "Critical"]))
        .order_by(RiskAssessment.risk_percent.desc())
        .limit(5)
        .all()
    )
    alerts = [
        CriticalAlert(
            asset_id=risk.asset_id,
            station_id=asset.station_id,
            location=asset.location,
            title=ALERT_TITLE_BY_ISSUE.get(risk.likely_issue, risk.likely_issue),
            severity="Critical" if risk.category == "Critical" else "High",
            timestamp=risk.updated_at,
        )
        for risk, asset in top_risks
    ]
    offline_assets = db.query(Asset).filter(Asset.status == "OFFLINE").limit(3).all()
    for asset in offline_assets:
        alerts.append(
            CriticalAlert(
                asset_id=asset.asset_id,
                station_id=asset.station_id,
                location=asset.location,
                title="Station Offline",
                severity="High",
                timestamp=datetime.utcnow(),
            )
        )

    trend_rows = (
        db.query(DailyHealthSnapshot.day, DailyHealthSnapshot.score).order_by(DailyHealthSnapshot.day.asc()).all()
    )
    by_day: dict = {}
    for day, score in trend_rows:
        by_day.setdefault(day, []).append(score)
    health_trend = [
        HealthTrendPoint(day=day, avg_score=round(sum(scores) / len(scores), 1))
        for day, scores in sorted(by_day.items())
    ][-7:]

    issue_rows = (
        db.query(RiskAssessment.likely_issue)
        .filter(RiskAssessment.category != "Low")
        .all()
    )
    issue_counts = Counter(row[0] for row in issue_rows)
    total_issues = sum(issue_counts.values())
    top_failure_reasons = [
        FailureReason(reason=reason, pct=_pct(count, total_issues))
        for reason, count in issue_counts.most_common(5)
    ]

    summary = OperationsSummary(
        kpis=KPIs(
            total_assets=total_assets,
            healthy=healthy,
            at_risk=at_risk,
            critical=critical,
            predicted_risk=predicted_risk,
            active_incidents=active_incidents,
            offline=offline,
        ),
        health_distribution=health_buckets,
        risk_summary=RiskSummary(
            high_risk_assets=high_risk_assets,
            maintenance_due=maintenance_due,
            predicted_failures=predicted_risk,
        ),
        top_critical_alerts=alerts[:6],
        health_trend=health_trend,
        top_failure_reasons=top_failure_reasons,
        generated_at=datetime.utcnow(),
    )
    logger.info(
        "api.operations/get_operations_summary - end",
        extra={"params": {"total_assets": total_assets}},
    )
    return summary


@router.get("/risks", response_model=list[RiskListItem])
def get_operations_risks(
    db: Session = Depends(get_db),
    sort_by: str = Query("risk", pattern="^(risk|impact|priority|location)$"),
    limit: int = Query(100, le=500),
) -> list[RiskListItem]:
    rows = (
        db.query(RiskAssessment, Asset)
        .join(Asset, Asset.asset_id == RiskAssessment.asset_id)
        .filter(RiskAssessment.category != "Low")
        .all()
    )
    items = [
        RiskListItem(
            asset_id=risk.asset_id,
            station_id=asset.station_id,
            location=asset.location,
            risk_percent=risk.risk_percent,
            category=risk.category,
            likely_issue=risk.likely_issue,
            impact={"Critical": "High", "High": "High", "Moderate": "Medium", "Low": "Low"}[risk.category],
            priority=risk.priority,
            prediction_window_hours=risk.prediction_window_hours,
        )
        for risk, asset in rows
    ]

    sort_key = {
        "risk": lambda i: -i.risk_percent,
        "impact": lambda i: -{"High": 3, "Medium": 2, "Low": 1}[i.impact],
        "priority": lambda i: i.priority,
        "location": lambda i: i.location,
    }[sort_by]
    items.sort(key=sort_key)
    return items[:limit]
