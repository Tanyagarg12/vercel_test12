from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class KPIs(BaseModel):
    total_assets: int
    healthy: int
    at_risk: int
    critical: int
    predicted_risk: int
    active_incidents: int
    offline: int


class HealthDistributionBucket(BaseModel):
    label: str
    count: int
    pct: float


class FailureReason(BaseModel):
    reason: str
    pct: float


class HealthTrendPoint(BaseModel):
    day: date
    avg_score: float


class CriticalAlert(BaseModel):
    asset_id: str
    station_id: str
    location: str
    title: str
    severity: str
    timestamp: datetime


class RiskSummary(BaseModel):
    high_risk_assets: int
    maintenance_due: int
    predicted_failures: int


class OperationsSummary(BaseModel):
    kpis: KPIs
    health_distribution: list[HealthDistributionBucket]
    risk_summary: RiskSummary
    top_critical_alerts: list[CriticalAlert]
    health_trend: list[HealthTrendPoint]
    top_failure_reasons: list[FailureReason]
    generated_at: datetime


class RiskListItem(BaseModel):
    asset_id: str
    station_id: str
    location: str
    risk_percent: float
    category: str
    likely_issue: str
    impact: str
    priority: str
    prediction_window_hours: int


class FieldActionCreate(BaseModel):
    asset_id: str


class FieldActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    action_id: str
    asset_id: str
    issue: str
    priority: str
    sla_hours: int
    recommended_checks: list[str]
    assigned_status: str
    created_at: datetime


class DemoScenarioRequest(BaseModel):
    asset_id: str
    scenario_key: str
    severity: str = "HIGH"
    duration_days: int = 5


class DemoResetResponse(BaseModel):
    assets: int
    as_of: str
