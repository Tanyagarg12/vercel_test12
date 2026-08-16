from app.models.asset import Asset
from app.models.scoring import HealthScore, RiskAssessment
from app.schemas.assets import AssetDetail, AssetSummary


def to_asset_summary(
    asset: Asset,
    health: HealthScore | None,
    risk: RiskAssessment | None,
    cls=AssetSummary,
):
    return cls(
        asset_id=asset.asset_id,
        station_id=asset.station_id,
        asset_type=asset.asset_type,
        location=asset.location,
        latitude=asset.latitude,
        longitude=asset.longitude,
        status=asset.status,
        installation_date=getattr(asset, "installation_date", None),
        health_score=health.score if health else None,
        health_classification=health.classification if health else None,
        risk_percent=risk.risk_percent if risk else None,
        risk_category=risk.category if risk else None,
        likely_issue=risk.likely_issue if risk else None,
        priority=risk.priority if risk else None,
    )


def to_asset_detail(asset: Asset, health: HealthScore | None, risk: RiskAssessment | None) -> AssetDetail:
    return to_asset_summary(asset, health, risk, cls=AssetDetail)
