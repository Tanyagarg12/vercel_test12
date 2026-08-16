import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _new_action_id() -> str:
    return f"FA-{uuid.uuid4().hex[:8].upper()}"


class FieldAction(Base):
    """A field action created from a recommendation (POC-06 section 10.3)."""

    __tablename__ = "field_actions"

    action_id: Mapped[str] = mapped_column(String(16), primary_key=True, default=_new_action_id)
    asset_id: Mapped[str] = mapped_column(String(32), ForeignKey("assets.asset_id"), index=True)
    issue: Mapped[str] = mapped_column(String(64))
    priority: Mapped[str] = mapped_column(String(4))
    sla_hours: Mapped[int] = mapped_column(default=24)
    recommended_checks: Mapped[list[str]] = mapped_column(JSON, default=list)
    assigned_status: Mapped[str] = mapped_column(String(16), default="UNASSIGNED")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
