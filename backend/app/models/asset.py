from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Asset(Base):
    __tablename__ = "assets"

    asset_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    station_id: Mapped[str] = mapped_column(String(32), index=True)
    asset_type: Mapped[str] = mapped_column(String(32), default="QIS")
    location: Mapped[str] = mapped_column(String(64))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    installation_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    telemetry = relationship("Telemetry", back_populates="asset", cascade="all, delete-orphan")
    health_score = relationship(
        "HealthScore", back_populates="asset", uselist=False, cascade="all, delete-orphan"
    )
    risk_assessment = relationship(
        "RiskAssessment", back_populates="asset", uselist=False, cascade="all, delete-orphan"
    )
