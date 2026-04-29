import logging
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.strategies import STRATEGIES, get_strategy, DEFAULT_STRATEGY_A, DEFAULT_STRATEGY_B
from app.core.rate_limit import enforce_ip_limit
from app.db.session import get_db
from app.db import crud
from app.graphs.mode1 import BattleState, mode1_graph
from app.graphs.mode3 import DebateState, mode3_graph
from app.models.registry import DEFAULT_JUDGE_MODEL, ModelTier, get_model, list_models

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["battles"])


# ── request / response schemas ───────────────────────────────────────────────


class BattleRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=10_000)
    mode: Literal["model_vs_model", "strategy_vs_strategy", "adversarial_debate"] = "model_vs_model"
    # Mode 1 & 3
    agent_a_model: str = "groq-llama-4-scout"
    agent_b_model: str = "groq-llama-3.1-8b"
    # Mode 2
    strategy_model: str = "groq-llama-3.3-70b"
    strategy_a: str = DEFAULT_STRATEGY_A
    strategy_b: str = DEFAULT_STRATEGY_B
    # Shared
    judge_model: Optional[str] = None
    system_prompt: Optional[str] = Field(default=None, max_length=4_000)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    dual_pass: bool = False
    # Mode 3
    max_rounds: int = Field(default=2, ge=2, le=4)


class AgentSummary(BaseModel):
    model_key: str
    model_display_name: str
    response: str
    error: Optional[str]
    latency_ms: int


class BattleResponse(BaseModel):
    battle_id: str
    prompt: str
    mode: str
    judge_model: str
    agent_a: AgentSummary
    agent_b: AgentSummary
    verdict: dict
    created_at: str


# ── routes ───────────────────────────────────────────────────────────────────


@router.post("/battles", response_model=BattleResponse, dependencies=[Depends(enforce_ip_limit)])
async def create_battle(req: BattleRequest) -> BattleResponse:
    """Run a synchronous battle (all three modes) and return the full verdict."""
    judge_model = req.judge_model or DEFAULT_JUDGE_MODEL
    try:
        get_model(judge_model)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    battle_id = str(uuid.uuid4())

    # ── Mode 2: Strategy vs Strategy ─────────────────────────────────────────
    if req.mode == "strategy_vs_strategy":
        try:
            get_model(req.strategy_model)
            sys_a = get_strategy(req.strategy_a)["system_prompt"]
            sys_b = get_strategy(req.strategy_b)["system_prompt"]
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        state = BattleState(
            prompt=req.prompt, agent_a_model=req.strategy_model,
            agent_b_model=req.strategy_model, judge_model=judge_model,
            system_prompt=None, system_prompt_a=sys_a, system_prompt_b=sys_b,
            temperature=req.temperature, dual_pass=req.dual_pass,
            agent_results=[], verdict=None,
        )
        try:
            final_state = await mode1_graph.ainvoke(state)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

        results_by_id = {r["agent_id"]: r for r in final_state["agent_results"]}
        ra, rb = results_by_id.get("A", {}), results_by_id.get("B", {})

    # ── Mode 3: Adversarial Debate ────────────────────────────────────────────
    elif req.mode == "adversarial_debate":
        try:
            get_model(req.agent_a_model)
            get_model(req.agent_b_model)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        debate_state = DebateState(
            prompt=req.prompt, agent_a_model=req.agent_a_model,
            agent_b_model=req.agent_b_model, judge_model=judge_model,
            system_prompt=req.system_prompt, temperature=req.temperature,
            dual_pass=req.dual_pass, max_rounds=req.max_rounds,
            current_round=0, debate_rounds=[], last_results=[], verdict=None,
        )
        try:
            final_state = await mode3_graph.ainvoke(debate_state)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

        results_by_id = {r["agent_id"]: r for r in final_state.get("last_results", [])}
        ra, rb = results_by_id.get("A", {}), results_by_id.get("B", {})

    # ── Mode 1: Model vs Model (default) ─────────────────────────────────────
    else:
        try:
            get_model(req.agent_a_model)
            get_model(req.agent_b_model)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        state = BattleState(
            prompt=req.prompt, agent_a_model=req.agent_a_model,
            agent_b_model=req.agent_b_model, judge_model=judge_model,
            system_prompt=req.system_prompt, system_prompt_a=None, system_prompt_b=None,
            temperature=req.temperature, dual_pass=req.dual_pass,
            agent_results=[], verdict=None,
        )
        try:
            final_state = await mode1_graph.ainvoke(state)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

        results_by_id = {r["agent_id"]: r for r in final_state["agent_results"]}
        ra, rb = results_by_id.get("A", {}), results_by_id.get("B", {})

    logger.info(
        "Battle %s complete — winner: %s",
        battle_id,
        final_state.get("verdict", {}).get("winner", "unknown"),
    )

    response = BattleResponse(
        battle_id=battle_id,
        prompt=req.prompt,
        mode=req.mode,
        judge_model=judge_model,
        agent_a=AgentSummary(
            model_key=req.agent_a_model,
            model_display_name=ra.get("model_display_name", req.agent_a_model),
            response=ra.get("response", ""),
            error=ra.get("error"),
            latency_ms=ra.get("latency_ms", 0),
        ),
        agent_b=AgentSummary(
            model_key=req.agent_b_model,
            model_display_name=rb.get("model_display_name", req.agent_b_model),
            response=rb.get("response", ""),
            error=rb.get("error"),
            latency_ms=rb.get("latency_ms", 0),
        ),
        verdict=final_state["verdict"],
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    return response


# ── history endpoints ─────────────────────────────────────────────────────────


class BattleListItem(BaseModel):
    battle_id: str
    mode: str
    agent_a_model: str
    agent_a_display_name: str
    agent_b_model: str
    agent_b_display_name: str
    judge_model: str
    winner: Optional[str]
    created_at: str


class BattleListResponse(BaseModel):
    battles: list[BattleListItem]
    total: int
    page: int
    per_page: int


class BattleDetailResponse(BaseModel):
    battle_id: str
    mode: str
    prompt: str
    system_prompt: Optional[str]
    judge_model: str
    temperature: float
    dual_pass: bool
    agent_a: AgentSummary
    agent_b: AgentSummary
    verdict: Optional[dict]
    created_at: str


@router.get("/leaderboard", tags=["leaderboard"])
async def get_leaderboard(db: AsyncSession = Depends(get_db)):
    """Return win/loss/tie stats per model, ordered by win count."""
    data = await crud.get_leaderboard(db)
    return {"leaderboard": data}


@router.get("/battles", response_model=BattleListResponse, tags=["history"])
async def list_battles(
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
) -> BattleListResponse:
    if page < 1:
        raise HTTPException(status_code=422, detail="page must be >= 1")
    per_page = min(per_page, 100)

    battles, total = await crud.list_battles(db, page=page, per_page=per_page)

    items: list[BattleListItem] = []
    for b in battles:
        responses_by_agent = {r.agent_id: r for r in (b.responses or [])}
        ra = responses_by_agent.get("A")
        rb = responses_by_agent.get("B")
        items.append(BattleListItem(
            battle_id=str(b.id),
            mode=b.mode,
            agent_a_model=ra.model_key if ra else "?",
            agent_a_display_name=ra.model_display_name if ra else "?",
            agent_b_model=rb.model_key if rb else "?",
            agent_b_display_name=rb.model_display_name if rb else "?",
            judge_model=b.judge_model,
            winner=b.verdict.winner if b.verdict else None,
            created_at=b.created_at.isoformat(),
        ))

    return BattleListResponse(battles=items, total=total, page=page, per_page=per_page)


@router.get("/battles/{battle_id}", response_model=BattleDetailResponse, tags=["history"])
async def get_battle(
    battle_id: str,
    db: AsyncSession = Depends(get_db),
) -> BattleDetailResponse:
    battle = await crud.get_battle(db, battle_id)
    if battle is None:
        raise HTTPException(status_code=404, detail=f"Battle '{battle_id}' not found")

    responses_by_agent = {r.agent_id: r for r in (battle.responses or [])}
    ra = responses_by_agent.get("A")
    rb = responses_by_agent.get("B")

    return BattleDetailResponse(
        battle_id=str(battle.id),
        mode=battle.mode,
        prompt=battle.prompt,
        system_prompt=battle.system_prompt,
        judge_model=battle.judge_model,
        temperature=battle.temperature,
        dual_pass=battle.dual_pass,
        agent_a=AgentSummary(
            model_key=ra.model_key if ra else "",
            model_display_name=ra.model_display_name if ra else "",
            response=ra.response if ra else "",
            error=ra.error if ra else None,
            latency_ms=ra.latency_ms if ra else 0,
        ),
        agent_b=AgentSummary(
            model_key=rb.model_key if rb else "",
            model_display_name=rb.model_display_name if rb else "",
            response=rb.response if rb else "",
            error=rb.error if rb else None,
            latency_ms=rb.latency_ms if rb else 0,
        ),
        verdict={
            "winner": battle.verdict.winner,
            "scores_a": battle.verdict.scores_a,
            "scores_b": battle.verdict.scores_b,
            "key_differences": battle.verdict.key_differences,
            "reasoning": battle.verdict.reasoning,
        } if battle.verdict else None,
        created_at=battle.created_at.isoformat(),
    )


@router.get("/strategies")
async def list_strategies():
    """List available agent strategies for Mode 2."""
    return {
        "strategies": [
            {"key": k, "display_name": v["display_name"], "description": v["description"]}
            for k, v in STRATEGIES.items()
        ]
    }


@router.get("/models")
async def list_available_models(tier: Optional[str] = None):
    """List models in the registry, optionally filtered by tier (FREE or PAID)."""
    model_tier: Optional[ModelTier] = None
    if tier:
        try:
            model_tier = ModelTier(tier.upper())
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid tier '{tier}'. Use FREE or PAID.")

    models = list_models(tier=model_tier)
    return {
        "models": [
            {
                "key": key,
                "display_name": m.display_name,
                "family": m.family,
                "tier": m.tier,
                "provider": m.provider,
                "description": m.description,
                "context_window": m.context_window,
            }
            for key, m in models.items()
        ]
    }
