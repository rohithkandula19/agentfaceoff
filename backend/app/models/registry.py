from enum import Enum
from typing import Literal, Optional
from pydantic import BaseModel


class ModelTier(str, Enum):
    FREE = "FREE"
    PAID = "PAID"


class ModelConfig(BaseModel):
    display_name: str
    openrouter_id: str
    family: str
    tier: ModelTier
    provider: Literal["openrouter", "groq"] = "openrouter"
    context_window: int = 32768
    supports_tools: bool = False
    description: str = ""


MODEL_REGISTRY: dict[str, ModelConfig] = {
    # ── Groq models (ultra-fast inference) ────────────────────────────────
    "groq-llama-4-scout": ModelConfig(
        display_name="Llama 4 Scout (Groq)",
        openrouter_id="meta-llama/llama-4-scout-17b-16e-instruct",
        family="meta",
        tier=ModelTier.FREE,
        provider="groq",
        context_window=131072,
        description="Meta's Llama 4 Scout 17B MoE on Groq",
    ),
    "groq-qwen3-32b": ModelConfig(
        display_name="Qwen3 32B (Groq)",
        openrouter_id="qwen/qwen3-32b",
        family="qwen",
        tier=ModelTier.FREE,
        provider="groq",
        context_window=131072,
        description="Qwen3 32B on Groq — strong reasoning and coding",
    ),
    "groq-llama-3.3-70b": ModelConfig(
        display_name="Llama 3.3 (Groq)",
        openrouter_id="llama-3.3-70b-versatile",
        family="meta",
        tier=ModelTier.FREE,
        provider="groq",
        context_window=131072,
        description="Llama 3.3 70B on Groq",
    ),
    "groq-llama-3.1-8b": ModelConfig(
        display_name="Llama 3.1 (Groq)",
        openrouter_id="llama-3.1-8b-instant",
        family="meta",
        tier=ModelTier.FREE,
        provider="groq",
        context_window=131072,
        description="Llama 3.1 8B on Groq — fastest, highest quota",
    ),
    # ── OpenRouter free models ─────────────────────────────────────────────
    "gemma-4-31b": ModelConfig(
        display_name="Gemma 4",
        openrouter_id="google/gemma-4-31b-it:free",
        family="google",
        tier=ModelTier.FREE,
        context_window=262144,
        description="Google Gemma 4 31B — latest generation",
    ),
    "qwen3-coder": ModelConfig(
        display_name="Qwen3 Coder",
        openrouter_id="qwen/qwen3-coder:free",
        family="qwen",
        tier=ModelTier.FREE,
        context_window=262000,
        description="Qwen3 Coder 480B A35B — coding specialist",
    ),
    "hermes-3-405b": ModelConfig(
        display_name="Hermes 3 405B",
        openrouter_id="nousresearch/hermes-3-llama-3.1-405b:free",
        family="nous",
        tier=ModelTier.FREE,
        context_window=131072,
        description="Nous Hermes 3 on Llama 3.1 405B — largest free model",
    ),
    "gpt-oss-120b": ModelConfig(
        display_name="GPT-OSS",
        openrouter_id="openai/gpt-oss-120b:free",
        family="openai-oss",
        tier=ModelTier.FREE,
        context_window=131072,
        description="OpenAI open-source 120B model",
    ),
    "nemotron-super": ModelConfig(
        display_name="Nemotron Super",
        openrouter_id="nvidia/nemotron-3-super-120b-a12b:free",
        family="nvidia",
        tier=ModelTier.FREE,
        context_window=262144,
        description="NVIDIA Nemotron Super 120B MoE",
    ),
    # --- PAID models: uncomment when ready ---
    # "claude-opus-4-7": ModelConfig(
    #     display_name="Claude Opus 4.7",
    #     openrouter_id="anthropic/claude-opus-4-7",
    #     family="anthropic",
    #     tier=ModelTier.PAID,
    #     description="Anthropic's most capable model",
    # ),
    # "gpt-5": ModelConfig(
    #     display_name="GPT-5",
    #     openrouter_id="openai/gpt-5",
    #     family="openai",
    #     tier=ModelTier.PAID,
    #     description="OpenAI's latest flagship model",
    # ),
}

DEFAULT_JUDGE_MODEL = "groq-llama-3.1-8b"


def get_model(model_key: str) -> ModelConfig:
    if model_key not in MODEL_REGISTRY:
        available = list(MODEL_REGISTRY.keys())
        raise ValueError(f"Model '{model_key}' not in registry. Available: {available}")
    return MODEL_REGISTRY[model_key]


def list_models(tier: Optional[ModelTier] = None) -> dict[str, ModelConfig]:
    if tier is None:
        return MODEL_REGISTRY
    return {k: v for k, v in MODEL_REGISTRY.items() if v.tier == tier}
