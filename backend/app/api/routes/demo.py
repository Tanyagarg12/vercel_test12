from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.asset import Asset
from app.models.scenario import ScenarioInjection
from app.models.telemetry import Telemetry
from app.schemas.operations import DemoResetResponse, DemoScenarioRequest
from app.scripts.seed import reset_demo_dataset
from app.services.generator import reapply_scenario
from app.services.pipeline import score_asset
from app.services.scenarios import SCENARIOS, ScenarioInjectionSpec

router = APIRouter(prefix="/demo", tags=["demo"])
logger = get_logger("api.demo")


@router.post("/reset", response_model=DemoResetResponse)
def reset_demo(db: Session = Depends(get_db)) -> DemoResetResponse:
    """Rebuild the baseline dataset and re-run the full scoring pipeline
    (spec section 14 — the demo must be resettable to a known-good state)."""
    logger.info("api.demo/reset_demo - start", extra={"params": {}})
    result = reset_demo_dataset(db)
    logger.info("api.demo/reset_demo - end", extra={"params": result})
    return DemoResetResponse(**result)


@router.post("/scenario")
def inject_scenario(payload: DemoScenarioRequest, db: Session = Depends(get_db)) -> dict:
    """Inject a failure scenario into a single asset's most recent telemetry
    and immediately re-run scoring for it (spec section 6.5 — Scenario Control)."""
    logger.info(
        "api.demo/inject_scenario - start",
        extra={"params": {"asset_id": payload.asset_id, "scenario": payload.scenario_key}},
    )
    if payload.scenario_key not in SCENARIOS:
        raise HTTPException(status_code=400, detail=f"Unknown scenario '{payload.scenario_key}'")

    asset = db.query(Asset).filter(Asset.asset_id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset {payload.asset_id} not found")

    db.add(
        ScenarioInjection(
            asset_id=payload.asset_id,
            scenario_type=payload.scenario_key,
            severity=payload.severity,
            duration_days=payload.duration_days,
        )
    )

    telemetry = (
        db.query(Telemetry)
        .filter(Telemetry.asset_id == payload.asset_id)
        .order_by(Telemetry.timestamp.asc())
        .all()
    )
    if not telemetry:
        raise HTTPException(status_code=400, detail=f"No telemetry available for {payload.asset_id}")

    spec = ScenarioInjectionSpec(
        scenario_key=payload.scenario_key,
        severity=payload.severity,
        duration_days=payload.duration_days,
        asset_id=payload.asset_id,
    )
    reapply_scenario(telemetry, spec)

    now = telemetry[-1].timestamp
    score_asset(db, payload.asset_id, telemetry, now)
    db.commit()

    logger.info("api.demo/inject_scenario - end", extra={"params": {"asset_id": payload.asset_id}})
    return {"asset_id": payload.asset_id, "scenario": payload.scenario_key, "status": "scored"}
