from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import JSON


class Base(DeclarativeBase):
    pass


class Battle(Base):
    __tablename__ = "battles"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    mode: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    judge_model: Mapped[str] = mapped_column(String(100), nullable=False)
    temperature: Mapped[float] = mapped_column(Float, nullable=False)
    dual_pass: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    responses: Mapped[list["AgentResponse"]] = relationship(
        back_populates="battle", cascade="all, delete-orphan"
    )
    verdict: Mapped["VerdictRow | None"] = relationship(
        back_populates="battle", uselist=False, cascade="all, delete-orphan"
    )


class AgentResponse(Base):
    __tablename__ = "agent_responses"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    battle_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("battles.id"), nullable=False, index=True
    )
    agent_id: Mapped[str] = mapped_column(String(1), nullable=False)  # "A" or "B"
    model_key: Mapped[str] = mapped_column(String(100), nullable=False)
    model_display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    battle: Mapped["Battle"] = relationship(back_populates="responses")


class VerdictRow(Base):
    __tablename__ = "verdicts"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    battle_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("battles.id"), nullable=False, unique=True, index=True
    )
    winner: Mapped[str] = mapped_column(String(5), nullable=False)  # "A", "B", "tie"
    scores_a: Mapped[dict] = mapped_column(JSON, nullable=False)
    scores_b: Mapped[dict] = mapped_column(JSON, nullable=False)
    key_differences: Mapped[list] = mapped_column(JSON, nullable=False)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)

    battle: Mapped["Battle"] = relationship(back_populates="verdict")


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
