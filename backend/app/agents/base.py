import time
import logging
from typing import Awaitable, Callable, TypedDict, Literal, Optional

from openai import AsyncOpenAI

from app.core.config import settings
from app.models.registry import get_model, ModelConfig

logger = logging.getLogger(__name__)

_openrouter_client: Optional[AsyncOpenAI] = None
_groq_client: Optional[AsyncOpenAI] = None


def get_openrouter_client() -> AsyncOpenAI:
    global _openrouter_client
    if _openrouter_client is None:
        _openrouter_client = AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            default_headers={
                "HTTP-Referer": "https://agentfaceoff.com",
                "X-Title": "AgentFaceOff",
            },
        )
    return _openrouter_client


def get_groq_client() -> AsyncOpenAI:
    global _groq_client
    if _groq_client is None:
        _groq_client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
        )
    return _groq_client


def _get_client(model_config: ModelConfig) -> AsyncOpenAI:
    if model_config.provider == "groq":
        return get_groq_client()
    return get_openrouter_client()


class AgentRunInput(TypedDict):
    agent_id: Literal["A", "B"]
    model_key: str
    prompt: str
    system_prompt: Optional[str]
    temperature: float


class AgentResult(TypedDict):
    agent_id: Literal["A", "B"]
    model_key: str
    model_display_name: str
    response: str
    error: Optional[str]
    latency_ms: int


async def run_agent_call(input: AgentRunInput) -> AgentResult:
    """Run a single agent LLM call and return the result."""
    model_config = get_model(input["model_key"])
    client = _get_client(model_config)

    messages: list[dict] = []
    if input.get("system_prompt"):
        messages.append({"role": "system", "content": input["system_prompt"]})
    messages.append({"role": "user", "content": input["prompt"]})

    start_ms = int(time.time() * 1000)
    try:
        response = await client.chat.completions.create(
            model=model_config.openrouter_id,
            messages=messages,
            temperature=input.get("temperature", 0.7),
            max_tokens=2048,
        )
        latency_ms = int(time.time() * 1000) - start_ms
        content = response.choices[0].message.content or ""
        logger.info(
            "Agent %s (%s) completed in %dms, %d chars",
            input["agent_id"],
            model_config.display_name,
            latency_ms,
            len(content),
        )
        return AgentResult(
            agent_id=input["agent_id"],
            model_key=input["model_key"],
            model_display_name=model_config.display_name,
            response=content,
            error=None,
            latency_ms=latency_ms,
        )
    except Exception as exc:
        latency_ms = int(time.time() * 1000) - start_ms
        logger.error("Agent %s failed after %dms: %s", input["agent_id"], latency_ms, exc)
        return AgentResult(
            agent_id=input["agent_id"],
            model_key=input["model_key"],
            model_display_name=model_config.display_name,
            response="",
            error=str(exc),
            latency_ms=latency_ms,
        )


TokenCallback = Callable[[str], Awaitable[None]]


async def stream_agent_call(
    input: AgentRunInput,
    on_token: TokenCallback,
    messages: Optional[list[dict]] = None,
) -> AgentResult:
    """
    Stream tokens from an agent, invoking on_token for each chunk.
    Returns the full AgentResult once the stream is exhausted.
    Falls back to returning a partial response if the stream errors mid-way.
    """
    model_config = get_model(input["model_key"])
    client = _get_client(model_config)

    if messages is None:
        messages_to_send: list[dict] = []
        if input.get("system_prompt"):
            messages_to_send.append({"role": "system", "content": input["system_prompt"]})
        messages_to_send.append({"role": "user", "content": input["prompt"]})
    else:
        messages_to_send = messages

    start_ms = int(time.time() * 1000)
    full_response = ""

    try:
        stream = await client.chat.completions.create(
            model=model_config.openrouter_id,
            messages=messages_to_send,
            temperature=input.get("temperature", 0.7),
            max_tokens=2048,
            stream=True,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                token: str = chunk.choices[0].delta.content
                full_response += token
                await on_token(token)

        latency_ms = int(time.time() * 1000) - start_ms
        logger.info(
            "Agent %s (%s) streamed %d chars in %dms",
            input["agent_id"],
            model_config.display_name,
            len(full_response),
            latency_ms,
        )
        return AgentResult(
            agent_id=input["agent_id"],
            model_key=input["model_key"],
            model_display_name=model_config.display_name,
            response=full_response,
            error=None,
            latency_ms=latency_ms,
        )
    except Exception as exc:
        latency_ms = int(time.time() * 1000) - start_ms
        logger.error("Streaming agent %s failed after %dms: %s", input["agent_id"], latency_ms, exc)
        return AgentResult(
            agent_id=input["agent_id"],
            model_key=input["model_key"],
            model_display_name=model_config.display_name,
            response=full_response,  # return whatever arrived before the error
            error=str(exc),
            latency_ms=latency_ms,
        )
