"""Resets the demo environment: rebuilds the asset master + telemetry
history and re-runs the full scoring pipeline (POC-09 / spec section 14).

Usable as a standalone script (`python -m app.scripts.seed`) or imported
by the `/demo/reset` API endpoint.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import Base, SessionLocal, engine
from app.models.asset import Asset
from app.models.field_action import FieldAction
from app.models.scenario import ScenarioInjection
from app.models.scoring import AnomalyEvent, DailyHealthSnapshot, HealthScore, Recommendation, RiskAssessment
from app.models.telemetry import Telemetry
from app.services.generator import generate_demo_dataset
from app.services.pipeline import score_asset

logger = get_logger("seed")


def _clear_existing_data(db: Session) -> None:
    for model in (
        FieldAction,
        AnomalyEvent,
        DailyHealthSnapshot,
        Recommendation,
        RiskAssessment,
        HealthScore,
        ScenarioInjection,
        Telemetry,
        Asset,
    ):
        db.query(model).delete()
    db.commit()


def reset_demo_dataset(db: Session | None = None) -> dict:
    settings = get_settings()
    logger.info("seed/reset_demo_dataset - start", extra={"params": {}})

    Base.metadata.create_all(bind=engine)

    owns_session = db is None
    db = db or SessionLocal()
    try:
        _clear_existing_data(db)

        now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        generated_assets, telemetry_by_asset, scenario_records = generate_demo_dataset(
            asset_count=settings.demo_asset_count,
            history_days=settings.demo_history_days,
            now=now,
        )

        for gen in generated_assets:
            db.add(gen.asset)
        db.flush()

        for rows in telemetry_by_asset.values():
            db.bulk_save_objects(rows)
        for record in scenario_records:
            db.add(record)
        db.flush()

        for gen in generated_assets:
            score_asset(db, gen.asset.asset_id, telemetry_by_asset[gen.asset.asset_id], now)

        db.commit()
        logger.info(
            "seed/reset_demo_dataset - end",
            extra={"params": {"assets": len(generated_assets)}},
        )
        return {"assets": len(generated_assets), "as_of": now.isoformat()}
    finally:
        if owns_session:
            db.close()


if __name__ == "__main__":
    result = reset_demo_dataset()
    logger.info("seed/main - complete", extra={"params": result})
