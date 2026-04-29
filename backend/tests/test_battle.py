"""
Smoke tests — run with: pytest backend/tests/
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_list_models(client):
    resp = client.get("/api/models")
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    assert len(data["models"]) >= 7


def test_list_models_free_tier(client):
    resp = client.get("/api/models?tier=FREE")
    assert resp.status_code == 200
    models = resp.json()["models"]
    assert all(m["tier"] == "FREE" for m in models)


def test_invalid_model_tier(client):
    resp = client.get("/api/models?tier=INVALID")
    assert resp.status_code == 422


def test_battle_unknown_model(client):
    resp = client.post("/api/battles", json={
        "prompt": "hello",
        "agent_a_model": "does-not-exist",
        "agent_b_model": "llama-3.3-70b",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_battle_mode1_mock():
    """End-to-end battle with mocked OpenRouter calls."""
    from app.graphs.mode1 import mode1_graph

    mock_choice = MagicMock()
    mock_choice.message.content = "42 is the answer."
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    judge_choice = MagicMock()
    judge_choice.message.content = """{
        "winner": "A",
        "scores_a": {"accuracy": 8, "reasoning": 8, "clarity": 9, "completeness": 8},
        "scores_b": {"accuracy": 7, "reasoning": 7, "clarity": 7, "completeness": 7},
        "key_differences": ["A is more concise", "B is more verbose", "A has better reasoning"],
        "reasoning": "Agent A provided a clearer, more accurate answer."
    }"""
    judge_response = MagicMock()
    judge_response.choices = [judge_choice]

    call_count = 0

    async def mock_create(**kwargs):
        nonlocal call_count
        call_count += 1
        return judge_response if call_count >= 3 else mock_response

    with patch("app.agents.base.get_openrouter_client") as mock_client_fn, \
         patch("app.judge.judge.get_openrouter_client") as mock_judge_client_fn:

        mock_client = AsyncMock()
        mock_client.chat.completions.create = mock_create
        mock_client_fn.return_value = mock_client
        mock_judge_client_fn.return_value = mock_client

        result = await mode1_graph.ainvoke({
            "prompt": "What is the meaning of life?",
            "agent_a_model": "llama-3.3-70b",
            "agent_b_model": "deepseek-r1",
            "judge_model": "llama-3.3-70b",
            "system_prompt": None,
            "temperature": 0.7,
            "dual_pass": False,
            "agent_results": [],
            "verdict": None,
        })

    assert result["verdict"]["winner"] in ("A", "B", "tie")
    assert len(result["agent_results"]) == 2
