# Architecture

## Request Flow

```
POST /api/battles
        │
        ▼
  Validate models
  (registry lookup)
        │
        ▼
  BattleState init
        │
  ┌─────┴──────┐  LangGraph Send API (parallel)
  ▼            ▼
Agent A      Agent B
(OpenRouter) (OpenRouter)
  │            │
  └─────┬──────┘  operator.add reducer merges results
        ▼
    Judge Node
  (randomised order,
   JSON structured output)
        │
        ▼
    Verdict
  (Pydantic schema)
        │
        ▼
  BattleResponse JSON
```

## LangGraph Graph (Mode 1)

```
START
  └─(conditional_edges / Send x2)
        ├─► run_agent {agent_id="A", model_key=...}
        └─► run_agent {agent_id="B", model_key=...}
                ↓  (both branches converge)
            judge
                ↓
              END
```

`agent_results` in `BattleState` uses `Annotated[list, operator.add]` as its reducer, so the two parallel `run_agent` writes are merged into a single list before `judge` runs.

## Judge Bias Mitigation

1. **Order randomisation** — on every call, a coin flip decides which agent's response is shown first.
2. **Dual-pass** (opt-in) — judge runs twice with swapped A/B order, in parallel. Agreement required; otherwise returns a tie. Scores are averaged when both passes agree.
3. **System prompt instruction** — judge is explicitly told not to favour longer responses and to ignore length unless conciseness was specified.

## Model Registry

`backend/app/models/registry.py` defines a `ModelConfig` Pydantic model and a `MODEL_REGISTRY` dict keyed by short human-readable IDs (e.g. `"deepseek-r1"`). Adding a new model is a single dict entry. Paid models are wired up but commented out for Phase 1.

## Phases

| Phase | Scope |
|-------|-------|
| 1 | Backend skeleton — registry, agents, judge, Mode 1 graph, REST API |
| 2 | WebSocket token streaming, Postgres persistence |
| 3 | Next.js frontend — split-screen, radar chart, live streaming |
| 4 | Mode 2 (ReAct vs Plan-Execute), Mode 3 (Adversarial Debate) |
| 5 | Rate limiting, history page, share URLs, GCP Cloud Run + Firebase deploy |
