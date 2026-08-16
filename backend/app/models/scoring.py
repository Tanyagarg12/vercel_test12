from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class HealthScore(Base):
    """Latest health snapshot for an asset (POC-03)."""

    __tablename__ = "health_scores"

    asset_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("assets.asset_id"), primary_key=True
    )
    score: Mapped[float] = mapped_column(Float)
    classification: Mapped[str] = mapped_column(String(16))
    temperature_score: Mapped[float] = mapped_column(Float)
    charging_score: Mapped[float] = mapped_column(Float)
    electrical_score: Mapped[float] = mapped_column(Float)
    connectivity_score: Mapped[float] = mapped_column(Float)
    operational_score: Mapped[float] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    asset = relationship("Asset", back_populates="health_score")


class AnomalyEvent(Base):
    """Detected anomaly events (POC-04)."""

    __tablename__ = "anomaly_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("assets.asset_id"), index=True
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    anomaly_score: Mapped[float] = mapped_column(Float)
    severity: Mapped[str] = mapped_column(String(16))
    detected_signals: Mapped[list[str]] = mapped_column(JSON, default=list)


class RiskAssessment(Base):
    """Latest predictive risk assessment for an asset (POC-05)."""

    __tablename__ = "risk_assessments"

    asset_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("assets.asset_id"), primary_key=True
    )
    risk_percent: Mapped[float] = mapped_column(Float)
    category: Mapped[str] = mapped_column(String(16))
    prediction_window_hours: Mapped[int] = mapped_column(Integer, default=48)
    likely_issue: Mapped[str] = mapped_column(String(64))
    priority: Mapped[str] = mapped_column(String(4))
    explanation: Mapped[str] = mapped_column(String(512))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    asset = relationship("Asset", back_populates="risk_assessment")


class Recommendation(Base):
    """Latest recommended field action for an asset (POC-06)."""

    __tablename__ = "recommendations"

    asset_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("assets.asset_id"), primary_key=True
    )
    priority: Mapped[str] = mapped_column(String(4))
    recommended_intervention_hours: Mapped[int] = mapped_column(Integer, default=24)
    likely_issue: Mapped[str] = mapped_column(String(64))
    suggested_checks: Mapped[list[str]] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DailyHealthSnapshot(Base):
    """Daily aggregated health score per asset, used for trend charts."""

    __tablename__ = "daily_health_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("assets.asset_id"), index=True
    )
    day: Mapped[date] = mapped_column(Date, index=True)
    score: Mapped[float] = mapped_column(Float)
    classification: Mapped[str] = mapped_column(String(16))
