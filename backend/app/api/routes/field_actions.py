from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.asset import Asset
from app.models.field_action import FieldAction
from app.models.scoring import Recommendation
from app.schemas.operations import FieldActionCreate, FieldActionResponse

router = APIRouter(tags=["field-actions"])
logger = get_logger("api.field_actions")


@router.post("/field-actions", response_model=FieldActionResponse, status_code=201)
def create_field_action(payload: FieldActionCreate, db: Session = Depends(get_db)) -> FieldActionResponse:
    logger.info(
        "api.field_actions/create_field_action - start", extra={"params": {"asset_id": payload.asset_id}}
    )
    asset = db.query(Asset).filter(Asset.asset_id == payload.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset {payload.asset_id} not found")

    recommendation = (
        db.query(Recommendation).filter(Recommendation.asset_id == payload.asset_id).first()
    )
    if not recommendation:
        raise HTTPException(
            status_code=400,
            detail=f"No active recommendation for {payload.asset_id}; nothing to action",
        )

    field_action = FieldAction(
        asset_id=payload.asset_id,
        issue=recommendation.likely_issue,
        priority=recommendation.priority,
        sla_hours=recommendation.recommended_intervention_hours,
        recommended_checks=recommendation.suggested_checks,
        assigned_status="UNASSIGNED",
    )
    db.add(field_action)
    db.commit()
    db.refresh(field_action)

    logger.info(
        "api.field_actions/create_field_action - end",
        extra={"params": {"action_id": field_action.action_id}},
    )
    return FieldActionResponse.model_validate(field_action)


@router.get("/field-actions", response_model=list[FieldActionResponse])
def list_field_actions(db: Session = Depends(get_db)) -> list[FieldActionResponse]:
    rows = db.query(FieldAction).order_by(FieldAction.created_at.desc()).all()
    return [FieldActionResponse.model_validate(r) for r in rows]
