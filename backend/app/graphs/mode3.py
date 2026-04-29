"""
Mode 3 — Adversarial Debate

Rounds 1..N:
  - Round 1: both agents answer the original prompt independently (parallel)
  - Round 2+: each agent sees the other's previous answer and must:
      CRITIQUE  — identify weaknesses in the opponent's answer
      REFINED   — improve their own answer

After all rounds: judge evaluates the final-round answers.

Graph topology (sequential rounds, parallel agents within each round):
  START → debate_round → [loop back if rounds remain] → judge → END
"""

import asyncio
import operator
from typing import Annotated, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.base import AgentResult, AgentRunInput, run_agent_call
from app.judge.judge import call_judge
from app.judge.schemas import Verdict
from app.models.registry import DEFAULT_JUDGE_MODEL


# ── state ─────────────────────────────────────────────────────────────────────


class DebateRound(TypedDict):
    round_num: int
    response_a: str
    response_b: str


class DebateState(TypedDict):
    prompt: str
    agent_a_model: str
    agent_b_model: str
    judge_model: str
    system_prompt: Optional[str]
    temperature: float
    dual_pass: bool
    max_rounds: int
    current_round: int
    debate_rounds: list[DebateRound]
    # final-round AgentResult objects for the judge
    last_results: Annotated[list[AgentResult], operator.add]
    verdict: Optional[dict]


# ── debate prompt builder ─────────────────────────────────────────────────────


def _debate_prompt(original: str, own_prev: str, opponent_prev: str) -> str:
    return (
        f"Original question:\n{original}\n\n"
        f"Your previous answer:\n{own_prev}\n\n"
        f"Your opponent's answer:\n{opponent_prev}\n\n"
        "Instructions:\n"
        "1. CRITIQUE: Identify specific weaknesses, factual errors, or missing aspects "
        "in your opponent's answer. Be precise.\n"
        "2. REFINED ANSWER: Improve your own answer. Keep what was correct, address "
        "any valid points raised, and defend positions where you were right.\n\n"
        "Format your response exactly as:\n\n"
        "CRITIQUE:\n[your critique]\n\n"
        "REFINED ANSWER:\n[your improved answer]"
    )


# ── nodes ─────────────────────────────────────────────────────────────────────


async def debate_round(state: DebateState) -> dict:
    """Run one debate round — both agents in parallel."""
    current_round = state["current_round"] + 1
    prev_rounds = state["debate_rounds"]

    if current_round == 1 or not prev_rounds:
        prompt_a = state["prompt"]
        prompt_b = state["prompt"]
        sys_a = state.get("system_prompt")
        sys_b = state.get("system_prompt")
    else:
        last = prev_rounds[-1]
        prompt_a = _debate_prompt(state["prompt"], last["response_a"], last["response_b"])
        prompt_b = _debate_prompt(state["prompt"], last["response_b"], last["response_a"])
        sys_a = None
        sys_b = None

    result_a, result_b = await asyncio.gather(
        run_agent_call(AgentRunInput(
            agent_id="A", model_key=state["agent_a_model"],
            prompt=prompt_a, system_prompt=sys_a, temperature=state["temperature"],
        )),
        run_agent_call(AgentRunInput(
            agent_id="B", model_key=state["agent_b_model"],
            prompt=prompt_b, system_prompt=sys_b, temperature=state["temperature"],
        )),
    )

    new_round = DebateRound(
        round_num=current_round,
        response_a=result_a["response"],
        response_b=result_b["response"],
    )

    update: dict = {
        "current_round": current_round,
        "debate_rounds": prev_rounds + [new_round],
    }
    # Only keep the latest results for the judge (overwrite via full replacement)
    if current_round >= state["max_rounds"]:
        update["last_results"] = [result_a, result_b]

    return update


async def judge_debate(state: DebateState) -> dict:
    """Judge the final-round responses."""
    results_by_id = {r["agent_id"]: r for r in state.get("last_results", [])}
    result_a = results_by_id.get("A")
    result_b = results_by_id.get("B")

    if result_a is None or result_b is None:
        # Fallback: reconstruct from debate_rounds
        last = state["debate_rounds"][-1]
        from app.models.registry import get_model
        result_a = result_a or {
            "agent_id": "A", "model_key": state["agent_a_model"],
            "model_display_name": get_model(state["agent_a_model"]).display_name,
            "response": last["response_a"], "error": None, "latency_ms": 0,
        }
        result_b = result_b or {
            "agent_id": "B", "model_key": state["agent_b_model"],
            "model_display_name": get_model(state["agent_b_model"]).display_name,
            "response": last["response_b"], "error": None, "latency_ms": 0,
        }

    verdict: Verdict = await call_judge(
        prompt=state["prompt"],
        result_a=result_a,
        result_b=result_b,
        judge_model_key=state.get("judge_model") or DEFAULT_JUDGE_MODEL,
        dual_pass=state.get("dual_pass", False),
    )
    return {"verdict": verdict.model_dump()}


# ── routing ───────────────────────────────────────────────────────────────────


def should_continue(state: DebateState) -> str:
    return "judge_debate" if state["current_round"] >= state["max_rounds"] else "debate_round"


# ── graph compilation ─────────────────────────────────────────────────────────


def build_mode3_graph() -> StateGraph:
    builder = StateGraph(DebateState)
    builder.add_node("debate_round", debate_round)
    builder.add_node("judge_debate", judge_debate)
    builder.add_edge(START, "debate_round")
    builder.add_conditional_edges(
        "debate_round", should_continue, ["debate_round", "judge_debate"]
    )
    builder.add_edge("judge_debate", END)
    return builder.compile()


mode3_graph = build_mode3_graph()
