"""
Mode 1 — Model vs Model
Mode 2 — Strategy vs Strategy  (same graph; per-agent system prompts carry the strategy)

Graph topology:
  START
    └─(Send x2)──► run_agent  ──► judge ──► END
                   (A & B run in parallel via LangGraph Send API)
"""

import operator
from typing import Annotated, Literal, Optional, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from app.agents.base import AgentResult, AgentRunInput, run_agent_call
from app.judge.judge import call_judge
from app.judge.schemas import Verdict
from app.models.registry import DEFAULT_JUDGE_MODEL


class BattleState(TypedDict):
    # ── inputs ──────────────────────────────────────────────────────────────
    prompt: str
    agent_a_model: str
    agent_b_model: str
    judge_model: str
    # shared fallback system prompt (Mode 1)
    system_prompt: Optional[str]
    # per-agent system prompts take precedence (Mode 2 strategies)
    system_prompt_a: Optional[str]
    system_prompt_b: Optional[str]
    temperature: float
    dual_pass: bool
    # ── parallel results (operator.add reducer merges both writes) ───────────
    agent_results: Annotated[list[AgentResult], operator.add]
    # ── final output ─────────────────────────────────────────────────────────
    verdict: Optional[dict]


# ── nodes ─────────────────────────────────────────────────────────────────────


async def run_agent(state: dict) -> dict:
    """LangGraph node: run one agent (receives AgentRunInput payload via Send)."""
    input_: AgentRunInput = {
        "agent_id": state["agent_id"],
        "model_key": state["model_key"],
        "prompt": state["prompt"],
        "system_prompt": state.get("system_prompt"),
        "temperature": state.get("temperature", 0.7),
    }
    result = await run_agent_call(input_)
    return {"agent_results": [result]}


async def judge(state: BattleState) -> dict:
    """LangGraph node: evaluate both agent results and produce a Verdict."""
    results_by_id: dict[Literal["A", "B"], AgentResult] = {
        r["agent_id"]: r for r in state["agent_results"]
    }
    result_a = results_by_id.get("A")
    result_b = results_by_id.get("B")
    if result_a is None or result_b is None:
        raise ValueError(f"Missing agent results; found keys: {list(results_by_id.keys())}")

    verdict: Verdict = await call_judge(
        prompt=state["prompt"],
        result_a=result_a,
        result_b=result_b,
        judge_model_key=state.get("judge_model") or DEFAULT_JUDGE_MODEL,
        dual_pass=state.get("dual_pass", False),
    )
    return {"verdict": verdict.model_dump()}


# ── routing ───────────────────────────────────────────────────────────────────


def route_to_agents(state: BattleState) -> list[Send]:
    """Fan out from START to two parallel run_agent executions."""
    base = {"prompt": state["prompt"], "temperature": state.get("temperature", 0.7)}
    # Per-agent system prompt wins; fall back to shared system_prompt
    sys_a = state.get("system_prompt_a") or state.get("system_prompt")
    sys_b = state.get("system_prompt_b") or state.get("system_prompt")
    return [
        Send("run_agent", {**base, "agent_id": "A", "model_key": state["agent_a_model"], "system_prompt": sys_a}),
        Send("run_agent", {**base, "agent_id": "B", "model_key": state["agent_b_model"], "system_prompt": sys_b}),
    ]


# ── graph compilation ─────────────────────────────────────────────────────────


def build_mode1_graph() -> StateGraph:
    builder = StateGraph(BattleState)
    builder.add_node("run_agent", run_agent)
    builder.add_node("judge", judge)
    builder.add_conditional_edges(START, route_to_agents, ["run_agent"])
    builder.add_edge("run_agent", "judge")
    builder.add_edge("judge", END)
    return builder.compile()


mode1_graph = build_mode1_graph()
