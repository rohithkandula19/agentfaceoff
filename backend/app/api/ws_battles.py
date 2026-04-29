"""
WebSocket battle endpoint — handles all three modes.

Protocol (server → client):
  {"type": "battle_started",      "battle_id": str, "mode": str}
  {"type": "token",               "channel": "agent_a"|"agent_b", "round": int, "content": str}
  {"type": "agent_done",          "channel": ..., "round": int, "model_display_name": str,
                                   "latency_ms": int, "error": str|null}
  {"type": "debate_round_start",  "round": int, "total_rounds": int}   ← Mode 3 only
  {"type": "debate_round_end",    "round": int}                         ← Mode 3 only
  {"type": "searching"}                                                      ← web_search=True only
  {"type": "search_images",        "images": [url, ...]}                    ← web_search=True only
  {"type": "judging"}
  {"type": "verdict",             "battle_id": str, "data": Verdict}
  {"type": "battle_complete",     "battle_id": str}
  {"type": "error",               "detail": str}
"""

import asyncio
import logging
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, ValidationError

from app.agents.base import AgentResult, AgentRunInput, stream_agent_call
from app.agents.strategies import get_strategy, DEFAULT_STRATEGY_A, DEFAULT_STRATEGY_B
from app.core.config import settings
from app.core.rate_limit import check_ip_limit_ws
from app.judge.judge import call_judge
from app.models.registry import DEFAULT_JUDGE_MODEL, get_model
from app.services.search import build_search_context

logger = logging.getLogger(__name__)
router = APIRouter()

_active_battles: int = 0
_active_lock = asyncio.Lock()


# ── request schema ────────────────────────────────────────────────────────────


class ConversationTurn(BaseModel):
    user_message: str
    response_a: str
    response_b: str


class WsBattleConfig(BaseModel):
    mode: Literal["model_vs_model", "strategy_vs_strategy", "adversarial_debate"] = "model_vs_model"
    prompt: str
    # Mode 1 & 3
    agent_a_model: str = "groq-llama-4-scout"
    agent_b_model: str = "groq-llama-3.1-8b"
    # Mode 2 (strategy_vs_strategy)
    strategy_model: str = "groq-llama-3.3-70b"   # same model for both strategies
    strategy_a: str = DEFAULT_STRATEGY_A
    strategy_b: str = DEFAULT_STRATEGY_B
    # Shared
    judge_model: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    dual_pass: bool = False
    # Mode 3
    max_rounds: int = Field(default=2, ge=2, le=4)
    # Web search
    web_search: bool = False
    # Follow-up chat
    conversation_turns: list[ConversationTurn] = []
    is_followup: bool = False


# ── helpers ───────────────────────────────────────────────────────────────────


async def _send(ws: WebSocket, msg: dict) -> None:
    await ws.send_json(msg)


# ── mode runners ──────────────────────────────────────────────────────────────


def _build_agent_messages(
    config: WsBattleConfig,
    agent_id: Literal["A", "B"],
) -> Optional[list[dict]]:
    """Build full message list with conversation history. Returns None if no history."""
    if not config.conversation_turns:
        return None
    msgs: list[dict] = []
    if config.system_prompt:
        msgs.append({"role": "system", "content": config.system_prompt})
    for turn in config.conversation_turns:
        msgs.append({"role": "user", "content": turn.user_message})
        resp = turn.response_a if agent_id == "A" else turn.response_b
        msgs.append({"role": "assistant", "content": resp})
    msgs.append({"role": "user", "content": config.prompt})
    return msgs


async def _run_mode1(ws: WebSocket, config: WsBattleConfig, battle_id: str, judge_model: str) -> tuple[AgentResult, AgentResult]:
    msg_queue: asyncio.Queue = asyncio.Queue()
    results: dict[str, AgentResult] = {}

    async def _run(agent_id: str, model_key: str, sys_prompt: Optional[str]) -> None:
        channel = "agent_a" if agent_id == "A" else "agent_b"
        async def on_token(t: str) -> None:
            await msg_queue.put({"type": "token", "channel": channel, "round": 1, "content": t})
        hist_messages = _build_agent_messages(config, agent_id)
        result = await stream_agent_call(
            AgentRunInput(agent_id=agent_id, model_key=model_key, prompt=config.prompt,
                          system_prompt=sys_prompt, temperature=config.temperature),
            on_token=on_token,
            messages=hist_messages,
        )
        results[agent_id] = result
        await msg_queue.put({"type": "agent_done", "channel": channel, "round": 1,
                              "model_display_name": result["model_display_name"],
                              "latency_ms": result["latency_ms"], "error": result.get("error")})

    async def _run_both() -> None:
        await asyncio.gather(
            _run("A", config.agent_a_model, config.system_prompt),
            _run("B", config.agent_b_model, config.system_prompt),
        )
    task = asyncio.create_task(_run_both())
    try:
        dones = 0
        while dones < 2:
            msg = await asyncio.wait_for(msg_queue.get(), timeout=180.0)
            if msg["type"] == "agent_done":
                dones += 1
            await _send(ws, msg)
        await task
    except BaseException:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        raise
    return results["A"], results["B"]


async def _run_mode2(ws: WebSocket, config: WsBattleConfig, battle_id: str, judge_model: str) -> tuple[AgentResult, AgentResult]:
    """Strategy vs Strategy: same model, different system prompts."""
    sys_a = get_strategy(config.strategy_a)["system_prompt"]
    sys_b = get_strategy(config.strategy_b)["system_prompt"]
    msg_queue: asyncio.Queue = asyncio.Queue()
    results: dict[str, AgentResult] = {}

    def _build_strategy_messages(agent_id: str, sys_prompt: str) -> Optional[list[dict]]:
        """Build conversation history with the agent's strategy system prompt."""
        if not config.conversation_turns:
            return None
        msgs: list[dict] = [{"role": "system", "content": sys_prompt}]
        for turn in config.conversation_turns:
            msgs.append({"role": "user", "content": turn.user_message})
            resp = turn.response_a if agent_id == "A" else turn.response_b
            msgs.append({"role": "assistant", "content": resp})
        msgs.append({"role": "user", "content": config.prompt})
        return msgs

    async def _run(agent_id: str, sys_prompt: str) -> None:
        channel = "agent_a" if agent_id == "A" else "agent_b"
        async def on_token(t: str) -> None:
            await msg_queue.put({"type": "token", "channel": channel, "round": 1, "content": t})
        hist_messages = _build_strategy_messages(agent_id, sys_prompt)
        result = await stream_agent_call(
            AgentRunInput(agent_id=agent_id, model_key=config.strategy_model, prompt=config.prompt,
                          system_prompt=None if hist_messages else sys_prompt,
                          temperature=config.temperature),
            on_token=on_token,
            messages=hist_messages,
        )
        results[agent_id] = result
        await msg_queue.put({"type": "agent_done", "channel": channel, "round": 1,
                              "model_display_name": result["model_display_name"],
                              "latency_ms": result["latency_ms"], "error": result.get("error")})

    async def _run_both() -> None:
        await asyncio.gather(_run("A", sys_a), _run("B", sys_b))
    task = asyncio.create_task(_run_both())

    try:
        dones = 0
        while dones < 2:
            msg = await asyncio.wait_for(msg_queue.get(), timeout=180.0)
            if msg["type"] == "agent_done":
                dones += 1
            await _send(ws, msg)
        await task
    except BaseException:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        raise
    return results["A"], results["B"]


async def _run_mode3(ws: WebSocket, config: WsBattleConfig, battle_id: str, judge_model: str) -> tuple[AgentResult, AgentResult]:
    """Adversarial Debate: N rounds, each agent sees the other's previous answer."""
    from app.graphs.mode3 import _debate_prompt

    prev_a = ""
    prev_b = ""
    final_a: Optional[AgentResult] = None
    final_b: Optional[AgentResult] = None

    for round_num in range(1, config.max_rounds + 1):
        await _send(ws, {"type": "debate_round_start", "round": round_num, "total_rounds": config.max_rounds})

        if round_num == 1:
            prompt_a = config.prompt
            prompt_b = config.prompt
            sys_a = config.system_prompt
            sys_b = config.system_prompt
        else:
            prompt_a = _debate_prompt(config.prompt, prev_a, prev_b)
            prompt_b = _debate_prompt(config.prompt, prev_b, prev_a)
            sys_a = None
            sys_b = None

        msg_queue: asyncio.Queue = asyncio.Queue()
        results: dict[str, AgentResult] = {}

        async def _run(agent_id: str, prompt: str, sys_prompt: Optional[str]) -> None:
            channel = "agent_a" if agent_id == "A" else "agent_b"
            async def on_token(t: str) -> None:
                await msg_queue.put({"type": "token", "channel": channel, "round": round_num, "content": t})
            result = await stream_agent_call(
                AgentRunInput(agent_id=agent_id, model_key=config.agent_a_model if agent_id == "A" else config.agent_b_model,
                              prompt=prompt, system_prompt=sys_prompt, temperature=config.temperature),
                on_token=on_token,
            )
            results[agent_id] = result
            await msg_queue.put({"type": "agent_done", "channel": channel, "round": round_num,
                                  "model_display_name": result["model_display_name"],
                                  "latency_ms": result["latency_ms"], "error": result.get("error")})

        async def _run_both() -> None:
            await asyncio.gather(_run("A", prompt_a, sys_a), _run("B", prompt_b, sys_b))
        task = asyncio.create_task(_run_both())

        try:
            dones = 0
            while dones < 2:
                msg = await asyncio.wait_for(msg_queue.get(), timeout=180.0)
                if msg["type"] == "agent_done":
                    dones += 1
                await _send(ws, msg)
            await task
        except BaseException:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            raise

        prev_a = results["A"]["response"]
        prev_b = results["B"]["response"]
        final_a = results["A"]
        final_b = results["B"]

        await _send(ws, {"type": "debate_round_end", "round": round_num})

    return final_a, final_b  # type: ignore[return-value]


# ── WebSocket handler ─────────────────────────────────────────────────────────


@router.websocket("/ws/battles")
async def battle_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    global _active_battles

    # Per-IP daily rate limit
    client_ip = (
        (websocket.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        or (websocket.client.host if websocket.client else "unknown")
    )
    if not await check_ip_limit_ws(client_ip):
        await _send(websocket, {
            "type": "error",
            "detail": f"Daily limit of {settings.per_ip_daily_limit} battles reached for your IP. Try again tomorrow.",
        })
        await websocket.close(code=1008)
        return

    try:
        raw = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
        config = WsBattleConfig(**raw)
    except (ValidationError, ValueError) as exc:
        await _send(websocket, {"type": "error", "detail": str(exc)})
        await websocket.close(code=1008)
        return
    except asyncio.TimeoutError:
        await _send(websocket, {"type": "error", "detail": "Config not received within 30 s"})
        await websocket.close(code=1008)
        return

    judge_model = config.judge_model or DEFAULT_JUDGE_MODEL

    # Validate all models / strategies upfront
    try:
        get_model(judge_model)
        if config.mode == "strategy_vs_strategy":
            get_model(config.strategy_model)
            get_strategy(config.strategy_a)
            get_strategy(config.strategy_b)
        else:
            get_model(config.agent_a_model)
            get_model(config.agent_b_model)
    except ValueError as exc:
        await _send(websocket, {"type": "error", "detail": str(exc)})
        await websocket.close(code=1008)
        return

    async with _active_lock:
        if _active_battles >= settings.max_concurrent_battles:
            await _send(websocket, {"type": "error",
                                     "detail": f"At capacity ({settings.max_concurrent_battles} battles). Retry shortly."})
            await websocket.close(code=1013)
            return
        _active_battles += 1

    battle_id = str(uuid.uuid4())

    try:
        # Resolve human-readable display names upfront so the frontend can show
        # them immediately — before the first agent_done message arrives.
        if config.mode == "strategy_vs_strategy":
            _display_a = config.strategy_a
            _display_b = config.strategy_b
        else:
            _display_a = get_model(config.agent_a_model).display_name
            _display_b = get_model(config.agent_b_model).display_name

        await _send(websocket, {
            "type": "battle_started",
            "battle_id": battle_id,
            "mode": config.mode,
            "max_rounds": config.max_rounds,
            "model_a_display": _display_a,
            "model_b_display": _display_b,
        })

        # ── Web search context injection ──────────────────────────────────────
        # Fetch live results before either agent runs so both get identical context.
        if config.web_search and not config.is_followup:
            await _send(websocket, {"type": "searching"})
            search_ctx, image_urls = await build_search_context(config.prompt)
            if search_ctx:
                config = config.model_copy(update={"prompt": search_ctx + config.prompt})
            if image_urls:
                await _send(websocket, {"type": "search_images", "images": image_urls})

        if config.mode == "model_vs_model":
            result_a, result_b = await _run_mode1(websocket, config, battle_id, judge_model)
        elif config.mode == "strategy_vs_strategy":
            result_a, result_b = await _run_mode2(websocket, config, battle_id, judge_model)
        else:
            result_a, result_b = await _run_mode3(websocket, config, battle_id, judge_model)

        if not config.is_followup:
            await _send(websocket, {"type": "judging"})
            verdict = await call_judge(
                prompt=config.prompt,
                result_a=result_a,
                result_b=result_b,
                judge_model_key=judge_model,
                dual_pass=config.dual_pass,
            )
            await _send(websocket, {"type": "verdict", "battle_id": battle_id, "data": verdict.model_dump()})
            asyncio.create_task(_persist(battle_id, config, judge_model, result_a, result_b, verdict))

        await _send(websocket, {"type": "battle_complete", "battle_id": battle_id})
        await websocket.close(code=1000)

    except WebSocketDisconnect:
        logger.info("Client disconnected during battle %s", battle_id)
    except asyncio.TimeoutError:
        try:
            await _send(websocket, {"type": "error", "detail": "Battle timed out"})
        except Exception:
            pass
    except Exception as exc:
        logger.error("Battle %s error: %s", battle_id, exc, exc_info=True)
        try:
            await _send(websocket, {"type": "error", "detail": str(exc)})
        except Exception:
            pass
    finally:
        async with _active_lock:
            _active_battles -= 1


async def _persist(battle_id, config, judge_model, result_a, result_b, verdict_obj) -> None:
    try:
        from app.db.session import AsyncSessionLocal
        from app.db import crud
        mode = config.mode
        async with AsyncSessionLocal() as db:
            await crud.save_battle(
                db=db, battle_id=battle_id, mode=mode, prompt=config.prompt,
                system_prompt=config.system_prompt, judge_model=judge_model,
                temperature=config.temperature, dual_pass=config.dual_pass,
                result_a=result_a, result_b=result_b, verdict=verdict_obj,
            )
    except Exception as exc:
        logger.error("Persist battle %s failed: %s", battle_id, exc)
