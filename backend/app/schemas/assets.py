from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class AssetSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: str
    station_id: str
    asset_type: str
    location: str
    latitude: float
    longitude: float
    status: str
    health_score: float | None = None
    health_classification: str | None = None
    risk_percent: float | None = None
    risk_category: str | None = None
    likely_issue: str | None = None
    priority: str | None = None


class AssetDetail(AssetSummary):
    installation_date: date


class TelemetryPoint(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    timestamp: datetime
    temperature: float
    voltage: float
    current: float
    charging_duration: float
    swap_count: int
    failed_swap_count: int
    connectivity_status: str
    error_code: str | None
    operational_status: str


class HealthDimensions(BaseModel):
    temperature: float
    charging: float
    electrical: float
    connectivity: float
    operational: float


class HealthHistoryPoint(BaseModel):
    day: date
    score: float
    classification: str


class HealthResponse(BaseModel):
    asset_id: str
    score: float
    classification: str
    dimensions: HealthDimensions
    updated_at: datetime
    history: list[HealthHistoryPoint] = []


class AnomalyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    timestamp: datetime
    anomaly_score: float
    severity: str
    detected_signals: list[str]


class RiskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: str
    risk_percent: float
    category: str
    prediction_window_hours: int
    likely_issue: str
    priority: str
    explanation: str
    updated_at: datetime


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: str
    priority: str
    recommended_intervention_hours: int
    likely_issue: str
    suggested_checks: list[str]
    updated_at: datetime
