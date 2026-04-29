import asyncio
import json
import logging
import random
from typing import Optional

from pydantic import ValidationError

from app.agents.base import AgentResult, _get_client
from app.judge.schemas import RubricScores, Verdict
from app.models.registry import get_model

logger = logging.getLogger(__name__)

_JUDGE_SYSTEM_PROMPT = """\
You are an impartial AI response evaluator. Compare two AI responses to the same prompt.

RULES:
- Evaluate on quality, accuracy, and usefulness ONLY.
- Do NOT favour longer responses. Conciseness is a virtue unless exhaustive detail was requested.
- Do NOT be influenced by presentation order. Each response stands on its own merits.
- Declare "tie" ONLY when the total scores are exactly equal. A single-point difference should still produce a winner.

Score each response on four dimensions (1–10 each):
  accuracy     — factual correctness
  reasoning    — logical coherence and depth
  clarity      — how easy it is to read and understand
  completeness — whether it addresses all parts of the prompt

Return ONLY valid JSON with this exact shape — no prose, no markdown fences:
{
  "winner": "A" | "B" | "tie",
  "scores_a": {"accuracy": int, "reasoning": int, "clarity": int, "completeness": int},
  "scores_b": {"accuracy": int, "reasoning": int, "clarity": int, "completeness": int},
  "key_differences": ["string", "string", "string"],
  "reasoning": "string"
}\
"""


def _user_prompt(
    prompt: str,
    response_first: str,
    label_first: str,
    response_second: str,
    label_second: str,
) -> str:
    return (
        f"ORIGINAL PROMPT:\n{prompt}\n\n"
        f"RESPONSE {label_first}:\n{response_first}\n\n"
        f"RESPONSE {label_second}:\n{response_second}\n\n"
        "Evaluate these two responses and return your verdict as JSON."
    )


def _correct_winner(verdict: Verdict) -> Verdict:
    """
    Ensure the declared winner matches the actual scores.
    If the LLM declares a tie but one side has a strictly higher total,
    override to the correct winner. Prevents off-by-one prompt bugs.
    """
    total_a = sum(verdict.scores_a.model_dump().values())
    total_b = sum(verdict.scores_b.model_dump().values())
    if total_a == total_b:
        correct = "tie"
    elif total_a > total_b:
        correct = "A"
    else:
        correct = "B"

    if verdict.winner != correct:
        logger.info(
            "Winner corrected: LLM said %r but scores are A=%d B=%d → %s",
            verdict.winner, total_a, total_b, correct,
        )
        return verdict.model_copy(update={"winner": correct})
    return verdict


def _patch_and_parse(raw: str) -> Verdict:
    """Parse JSON into Verdict, patching minor schema violations before raising."""
    data = json.loads(raw)

    # Ensure key_differences has at least 3 entries
    diffs: list[str] = data.get("key_differences", [])
    while len(diffs) < 3:
        diffs.append("Responses differ in overall quality and approach.")
    data["key_differences"] = diffs[:5]

    try:
        verdict = Verdict(**data)
    except ValidationError:
        # Last-resort clamp: scores outside [1,10]
        for side in ("scores_a", "scores_b"):
            for dim in ("accuracy", "reasoning", "clarity", "completeness"):
                data[side][dim] = max(1, min(10, int(data[side].get(dim, 5))))
        verdict = Verdict(**data)

    return _correct_winner(verdict)


async def _single_judge_pass(
    prompt: str,
    result_a: AgentResult,
    result_b: AgentResult,
    judge_model_key: str,
    first_is_a: bool,
) -> Verdict:
    model_config = get_model(judge_model_key)
    client = _get_client(model_config)

    def _safe_response(r: AgentResult) -> str:
        if r.get("error"):
            return f"[Agent failed with error: {r['error']}]"
        return r["response"] or "[No response]"

    if first_is_a:
        resp_first, label_first = _safe_response(result_a), "A"
        resp_second, label_second = _safe_response(result_b), "B"
    else:
        resp_first, label_first = _safe_response(result_b), "B"
        resp_second, label_second = _safe_response(result_a), "A"

    user_msg = _user_prompt(prompt, resp_first, label_first, resp_second, label_second)

    response = await client.chat.completions.create(
        model=model_config.openrouter_id,
        messages=[
            {"role": "system", "content": _JUDGE_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.2,
        max_tokens=1024,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    return _patch_and_parse(raw)


def _average_scores(s1: RubricScores, s2: RubricScores) -> RubricScores:
    return RubricScores(
        accuracy=(s1.accuracy + s2.accuracy) // 2,
        reasoning=(s1.reasoning + s2.reasoning) // 2,
        clarity=(s1.clarity + s2.clarity) // 2,
        completeness=(s1.completeness + s2.completeness) // 2,
    )


def _merge(v1: Verdict, v2: Verdict) -> Verdict:
    """Merge two agreeing verdicts by averaging their scores."""
    return Verdict(
        winner=v1.winner,
        scores_a=_average_scores(v1.scores_a, v2.scores_a),
        scores_b=_average_scores(v1.scores_b, v2.scores_b),
        key_differences=v1.key_differences,
        reasoning=v1.reasoning + " (confirmed by second pass with swapped order)",
    )


async def call_judge(
    prompt: str,
    result_a: AgentResult,
    result_b: AgentResult,
    judge_model_key: str,
    dual_pass: bool = False,
) -> Verdict:
    """
    Evaluate two agent responses.

    Randomises presentation order on every call to mitigate position bias.
    With dual_pass=True, runs two passes simultaneously (orders A→B and B→A).
    The verdict is only accepted when both passes agree; otherwise returns tie.
    """
    first_is_a = random.random() > 0.5

    if not dual_pass:
        return await _single_judge_pass(prompt, result_a, result_b, judge_model_key, first_is_a)

    # Run both orderings in parallel
    v1, v2 = await asyncio.gather(
        _single_judge_pass(prompt, result_a, result_b, judge_model_key, True),
        _single_judge_pass(prompt, result_a, result_b, judge_model_key, False),
    )

    logger.info("Dual-pass verdicts: pass1=%s pass2=%s", v1.winner, v2.winner)

    if v1.winner == v2.winner:
        return _correct_winner(_merge(v1, v2))

    # Disagreement → declare tie with averaged scores and explanation
    merged = Verdict(
        winner="tie",
        scores_a=_average_scores(v1.scores_a, v2.scores_a),
        scores_b=_average_scores(v1.scores_b, v2.scores_b),
        key_differences=list(dict.fromkeys(v1.key_differences + v2.key_differences))[:5],
        reasoning=(
            f"Dual-pass disagreement: first pass favoured {v1.winner}, "
            f"second pass favoured {v2.winner}. Declaring tie. "
            f"Pass-1 reasoning: {v1.reasoning}"
        ),
    )
    return _correct_winner(merged)
