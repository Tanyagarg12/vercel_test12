from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("assets.asset_id"), index=True
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    temperature: Mapped[float] = mapped_column(Float)
    voltage: Mapped[float] = mapped_column(Float)
    current: Mapped[float] = mapped_column(Float)
    charging_duration: Mapped[float] = mapped_column(Float)
    swap_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_swap_count: Mapped[int] = mapped_column(Integer, default=0)
    connectivity_status: Mapped[str] = mapped_column(String(16), default="STABLE")
    error_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    operational_status: Mapped[str] = mapped_column(String(16), default="NORMAL")

    asset = relationship("Asset", back_populates="telemetry")
