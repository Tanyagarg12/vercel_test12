from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.serializers import to_asset_detail, to_asset_summary
from app.core.logging import get_logger
from app.db.session import get_db
from app.models.asset import Asset
from app.models.scoring import (
    AnomalyEvent,
    DailyHealthSnapshot,
    HealthScore,
    Recommendation,
    RiskAssessment,
)
from app.models.telemetry import Telemetry
from app.schemas.assets import (
    AnomalyResponse,
    AssetDetail,
    AssetSummary,
    HealthDimensions,
    HealthHistoryPoint,
    HealthResponse,
    RecommendationResponse,
    RiskResponse,
    TelemetryPoint,
)

router = APIRouter(prefix="/assets", tags=["assets"])
logger = get_logger("api.assets")


def _get_asset_or_404(db: Session, asset_id: str) -> Asset:
    asset = db.query(Asset).filter(Asset.asset_id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")
    return asset


@router.get("", response_model=list[AssetSummary])
def list_assets(
    db: Session = Depends(get_db),
    status: str | None = None,
    classification: str | None = None,
    search: str | None = None,
    sort_by: str = Query("risk", pattern="^(risk|health|location|priority)$"),
    limit: int = Query(500, le=1000),
) -> list[AssetSummary]:
    logger.info("api.assets/list_assets - start", extra={"params": {"status": status, "search": search}})
    query = (
        db.query(Asset, HealthScore, RiskAssessment)
        .outerjoin(HealthScore, HealthScore.asset_id == Asset.asset_id)
        .outerjoin(RiskAssessment, RiskAssessment.asset_id == Asset.asset_id)
    )
    if status:
        query = query.filter(Asset.status == status.upper())
    if classification:
        query = query.filter(HealthScore.classification == classification)
    if search:
        like = f"%{search}%"
        query = query.filter((Asset.asset_id.ilike(like)) | (Asset.station_id.ilike(like)))

    rows = query.limit(limit).all()
    summaries = [to_asset_summary(asset, health, risk) for asset, health, risk in rows]

    if sort_by == "risk":
        summaries.sort(key=lambda s: s.risk_percent or 0, reverse=True)
    elif sort_by == "health":
        summaries.sort(key=lambda s: s.health_score or 100)
    elif sort_by == "location":
        summaries.sort(key=lambda s: s.location)
    elif sort_by == "priority":
        summaries.sort(key=lambda s: s.priority or "P9")

    logger.info("api.assets/list_assets - end", extra={"params": {"count": len(summaries)}})
    return summaries


@router.get("/{asset_id}", response_model=AssetDetail)
def get_asset(asset_id: str, db: Session = Depends(get_db)) -> AssetDetail:
    asset = _get_asset_or_404(db, asset_id)
    health = db.query(HealthScore).filter(HealthScore.asset_id == asset_id).first()
    risk = db.query(RiskAssessment).filter(RiskAssessment.asset_id == asset_id).first()
    return to_asset_detail(asset, health, risk)


@router.get("/{asset_id}/telemetry", response_model=list[TelemetryPoint])
def get_asset_telemetry(
    asset_id: str, db: Session = Depends(get_db), days: int = Query(7, ge=1, le=60)
) -> list[TelemetryPoint]:
    _get_asset_or_404(db, asset_id)
    latest = (
        db.query(Telemetry.timestamp)
        .filter(Telemetry.asset_id == asset_id)
        .order_by(Telemetry.timestamp.desc())
        .first()
    )
    if not latest:
        return []
    cutoff = latest[0] - timedelta(days=days)
    rows = (
        db.query(Telemetry)
        .filter(Telemetry.asset_id == asset_id, Telemetry.timestamp >= cutoff)
        .order_by(Telemetry.timestamp.asc())
        .all()
    )
    return [TelemetryPoint.model_validate(r) for r in rows]


@router.get("/{asset_id}/health", response_model=HealthResponse)
def get_asset_health(asset_id: str, db: Session = Depends(get_db)) -> HealthResponse:
    _get_asset_or_404(db, asset_id)
    health = db.query(HealthScore).filter(HealthScore.asset_id == asset_id).first()
    if not health:
        raise HTTPException(status_code=404, detail=f"No health score computed for {asset_id}")

    history_rows = (
        db.query(DailyHealthSnapshot)
        .filter(DailyHealthSnapshot.asset_id == asset_id)
        .order_by(DailyHealthSnapshot.day.asc())
        .all()
    )
    return HealthResponse(
        asset_id=asset_id,
        score=health.score,
        classification=health.classification,
        dimensions=HealthDimensions(
            temperature=health.temperature_score,
            charging=health.charging_score,
            electrical=health.electrical_score,
            connectivity=health.connectivity_score,
            operational=health.operational_score,
        ),
        updated_at=health.updated_at,
        history=[
            HealthHistoryPoint(day=r.day, score=r.score, classification=r.classification)
            for r in history_rows
        ],
    )


@router.get("/{asset_id}/risk", response_model=RiskResponse)
def get_asset_risk(asset_id: str, db: Session = Depends(get_db)) -> RiskResponse:
    _get_asset_or_404(db, asset_id)
    risk = db.query(RiskAssessment).filter(RiskAssessment.asset_id == asset_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail=f"No risk assessment computed for {asset_id}")
    return RiskResponse.model_validate(risk)


@router.get("/{asset_id}/anomalies", response_model=list[AnomalyResponse])
def get_asset_anomalies(asset_id: str, db: Session = Depends(get_db)) -> list[AnomalyResponse]:
    _get_asset_or_404(db, asset_id)
    rows = (
        db.query(AnomalyEvent)
        .filter(AnomalyEvent.asset_id == asset_id)
        .order_by(AnomalyEvent.timestamp.desc())
        .all()
    )
    return [AnomalyResponse.model_validate(r) for r in rows]


@router.get("/{asset_id}/recommendations", response_model=list[RecommendationResponse])
def get_asset_recommendations(asset_id: str, db: Session = Depends(get_db)) -> list[RecommendationResponse]:
    _get_asset_or_404(db, asset_id)
    rec = db.query(Recommendation).filter(Recommendation.asset_id == asset_id).first()
    if not rec:
        return []
    return [RecommendationResponse.model_validate(rec)]
