from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.base import AgentResult
from app.db.models import AgentResponse, Battle, VerdictRow
from app.judge.schemas import Verdict


async def save_battle(
    db: AsyncSession,
    battle_id: str,
    mode: str,
    prompt: str,
    system_prompt: str | None,
    judge_model: str,
    temperature: float,
    dual_pass: bool,
    result_a: AgentResult,
    result_b: AgentResult,
    verdict: Verdict,
) -> Battle:
    battle = Battle(
        id=UUID(battle_id),
        mode=mode,
        prompt=prompt,
        system_prompt=system_prompt,
        judge_model=judge_model,
        temperature=temperature,
        dual_pass=dual_pass,
        created_at=datetime.now(timezone.utc),
    )
    db.add(battle)

    for result in (result_a, result_b):
        db.add(
            AgentResponse(
                id=uuid4(),
                battle_id=UUID(battle_id),
                agent_id=result["agent_id"],
                model_key=result["model_key"],
                model_display_name=result["model_display_name"],
                response=result["response"],
                error=result.get("error"),
                latency_ms=result["latency_ms"],
            )
        )

    db.add(
        VerdictRow(
            id=uuid4(),
            battle_id=UUID(battle_id),
            winner=verdict.winner,
            scores_a=verdict.scores_a.model_dump(),
            scores_b=verdict.scores_b.model_dump(),
            key_differences=verdict.key_differences,
            reasoning=verdict.reasoning,
        )
    )

    await db.commit()
    return battle


async def get_battle(db: AsyncSession, battle_id: str) -> Battle | None:
    try:
        uid = UUID(battle_id)
    except ValueError:
        return None
    result = await db.execute(
        select(Battle)
        .where(Battle.id == uid)
        .options(selectinload(Battle.responses), selectinload(Battle.verdict))
    )
    return result.scalar_one_or_none()


async def list_battles(
    db: AsyncSession,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Battle], int]:
    offset = (page - 1) * per_page

    total_result = await db.execute(select(func.count()).select_from(Battle))
    total: int = total_result.scalar_one()

    rows_result = await db.execute(
        select(Battle)
        .options(selectinload(Battle.responses), selectinload(Battle.verdict))
        .order_by(desc(Battle.created_at))
        .offset(offset)
        .limit(per_page)
    )
    battles = list(rows_result.scalars().all())

    return battles, total


async def get_leaderboard(db: AsyncSession) -> list[dict]:
    """Return win/loss/tie stats per model across all battles."""
    from sqlalchemy import case as sa_case
    result = await db.execute(
        select(
            AgentResponse.model_key,
            AgentResponse.model_display_name,
            func.count().label("total"),
            func.sum(sa_case((VerdictRow.winner == AgentResponse.agent_id, 1), else_=0)).label("wins"),
            func.sum(sa_case((VerdictRow.winner == "tie", 1), else_=0)).label("ties"),
        )
        .join(VerdictRow, VerdictRow.battle_id == AgentResponse.battle_id)
        .group_by(AgentResponse.model_key, AgentResponse.model_display_name)
        .order_by(desc(func.sum(sa_case((VerdictRow.winner == AgentResponse.agent_id, 1), else_=0))))
    )
    rows = result.all()
    return [
        {
            "model_key": r.model_key,
            "model_display_name": r.model_display_name,
            "total": r.total,
            "wins": int(r.wins or 0),
            "ties": int(r.ties or 0),
            "losses": r.total - int(r.wins or 0) - int(r.ties or 0),
            "win_rate": round(int(r.wins or 0) / r.total * 100, 1) if r.total > 0 else 0.0,
        }
        for r in rows
    ]
