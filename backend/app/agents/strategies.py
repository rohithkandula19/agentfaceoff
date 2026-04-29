from typing import TypedDict


class StrategyConfig(TypedDict):
    display_name: str
    description: str
    system_prompt: str


STRATEGIES: dict[str, StrategyConfig] = {
    "react": {
        "display_name": "ReAct",
        "description": "Reason + Act + Observe loop — verbalises every step before acting.",
        "system_prompt": (
            "You solve problems using the ReAct framework.\n\n"
            "For every question cycle through:\n"
            "  Thought:      what you are reasoning about\n"
            "  Action:       what you check, calculate, or retrieve\n"
            "  Observation:  what the action reveals\n\n"
            "Repeat as many times as needed, then write:\n"
            "  Final Answer: your complete, direct answer\n\n"
            "Be explicit at every step. Show all work."
        ),
    },
    "plan_execute": {
        "display_name": "Plan & Execute",
        "description": "Decompose into a numbered plan first, then execute each step.",
        "system_prompt": (
            "You solve problems using the Plan-and-Execute framework.\n\n"
            "PLAN: Write a numbered list of every step needed to answer fully.\n"
            "EXECUTE: Work through each step in order, showing reasoning.\n"
            "FINAL ANSWER: One clear, direct answer synthesising the execution.\n\n"
            "Format:\n"
            "PLAN:\n1. ...\n2. ...\n\n"
            "EXECUTION:\nStep 1: ...\nStep 2: ...\n\n"
            "FINAL ANSWER: ..."
        ),
    },
    "chain_of_thought": {
        "display_name": "Chain of Thought",
        "description": "Linear numbered reasoning steps without act/observe framing.",
        "system_prompt": (
            "Think step by step in a clear chain of thought.\n\n"
            "Number each reasoning step. Do not skip steps.\n"
            "End with a concise Final Answer."
        ),
    },
    "direct": {
        "display_name": "Direct Answer",
        "description": "No explicit reasoning format — answer directly and efficiently.",
        "system_prompt": (
            "Answer directly, clearly, and as concisely as correct.\n"
            "Skip all preamble and meta-commentary."
        ),
    },
}

DEFAULT_STRATEGY_A = "react"
DEFAULT_STRATEGY_B = "plan_execute"


def get_strategy(key: str) -> StrategyConfig:
    if key not in STRATEGIES:
        raise ValueError(f"Strategy '{key}' not found. Available: {list(STRATEGIES.keys())}")
    return STRATEGIES[key]
