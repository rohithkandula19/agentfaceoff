# AgentFaceOff

> Two agents. One prompt. One winner.

A public LLM evaluation platform where two AI agents go head-to-head on the same prompt and an LLM judge picks the winner. Three battle modes, WebSocket live streaming, and a structured rubric verdict — built as a portfolio project demonstrating LangGraph, parallel agent execution, and structured LLM evaluation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + LangGraph 0.2+ + Python 3.12 |
| LLM Provider | OpenRouter (OpenAI-compatible, 7 free models) |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Database | PostgreSQL 16 (asyncpg + SQLAlchemy 2.0) |
| Deployment | GCP Cloud Run (backend) + Firebase Hosting (frontend) |

## Battle Modes

| Mode | Description |
|------|-------------|
| **Model vs Model** | Same prompt, different models — parallel streaming via LangGraph Send API |
| **Strategy vs Strategy** | Same model, ReAct vs Plan-and-Execute system prompts |
| **Adversarial Debate** | N rounds of critique and refinement between two models |

---

## Local Development

### Prerequisites

- Python 3.12
- Node 20+
- Docker & Docker Compose
- An [OpenRouter](https://openrouter.ai) API key (`sk-or-v1-…`)

### 1. Start Postgres

```bash
docker compose up postgres -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env — set OPENROUTER_API_KEY=sk-or-v1-...
# DATABASE_URL is already set for local docker compose

uvicorn app.main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health`

### 3. Frontend

```bash
cd frontend
npm install
# Create frontend/.env.local:
echo "VITE_API_URL=http://localhost:8000" > .env.local
echo "VITE_WS_URL=ws://localhost:8000" >> .env.local
npm run dev
```

Open http://localhost:5173

### 4. Full stack with Docker Compose

```bash
# Backend + Postgres only (frontend runs with Vite hot-reload separately)
docker compose up --build
```

---

## Deploy to GCP + Firebase

### Prerequisites

- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`)
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)
- A GCP project with Cloud Run, Cloud Build, and Container Registry APIs enabled
- A Firebase project linked to the same GCP project

### Backend — GCP Cloud Run

#### Option A: Cloud Build (CI/CD)

Connect your GitHub repo to Cloud Build and it will automatically trigger on push. The `backend/cloudbuild.yaml` handles everything:

```bash
# One-time manual trigger:
gcloud builds submit --config backend/cloudbuild.yaml \
  --project YOUR_GCP_PROJECT_ID \
  --substitutions _COMMIT_SHA=$(git rev-parse --short HEAD)
```

#### Option B: Manual deploy script

```bash
# Set your project
export PROJECT_ID=your-gcp-project-id
export REGION=us-central1

# Build and push
docker build -t gcr.io/$PROJECT_ID/agentfaceoff-backend:latest ./backend
docker push gcr.io/$PROJECT_ID/agentfaceoff-backend:latest

# Deploy to Cloud Run
gcloud run deploy agentfaceoff-backend \
  --image=gcr.io/$PROJECT_ID/agentfaceoff-backend:latest \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=300 \
  --set-env-vars="APP_ENV=production,MAX_CONCURRENT_BATTLES=5,PER_IP_DAILY_LIMIT=20" \
  --set-secrets="OPENROUTER_API_KEY=openrouter-api-key:latest,DATABASE_URL=database-url:latest"
```

> Store secrets in [Secret Manager](https://cloud.google.com/secret-manager): `openrouter-api-key` and `database-url`.

After deploy, note the Cloud Run URL (e.g. `https://agentfaceoff-backend-xxxx-uc.a.run.app`).

### Frontend — Firebase Hosting

```bash
cd frontend

# Build with production API URL
VITE_API_URL=https://agentfaceoff-backend-xxxx-uc.a.run.app \
VITE_WS_URL=wss://agentfaceoff-backend-xxxx-uc.a.run.app \
npm run build

# Deploy
firebase login
firebase use agentfaceoff   # or: firebase use --add
firebase deploy --only hosting
```

The `frontend/firebase.json` is already configured with:
- SPA rewrites (`**` → `/index.html`)
- Immutable cache headers for hashed assets
- Security headers (X-Frame-Options, X-XSS-Protection, X-Content-Type-Options)

---

## Environment Variables

### Backend (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | **Yes** | — | OpenRouter API key |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `APP_ENV` | No | `development` | `development` or `production` |
| `ALLOWED_ORIGINS` | No | `*` | Comma-separated CORS origins |
| `MAX_CONCURRENT_BATTLES` | No | `5` | Concurrent battle cap |
| `PER_IP_DAILY_LIMIT` | No | `20` | Max battles per IP per day |

### Frontend (`.env.local`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (no trailing slash) |
| `VITE_WS_URL` | Backend WebSocket base URL (`ws://` or `wss://`) |

---

## Free Model Lineup

| Display Name | Key | Family |
|---|---|---|
| DeepSeek R1 | `deepseek-r1` | DeepSeek |
| Llama 3.3 70B | `llama-3.3-70b` | Meta |
| Qwen3 Coder 480B | `qwen3-coder` | Qwen |
| GPT-OSS 120B | `gpt-oss-120b` | OpenAI OSS |
| Gemma 3 27B | `gemma-3-27b` | Google |
| Mistral Small 3 | `mistral-small-3` | Mistral |
| Nemotron Super | `nemotron-super` | NVIDIA |

Default judge: **Llama 3.3 70B**

---

## Project Structure

```
agentfaceoff/
├── backend/
│   ├── app/
│   │   ├── agents/          # stream_agent_call, strategy system prompts
│   │   ├── judge/           # call_judge, Verdict schema, dual-pass bias mitigation
│   │   ├── graphs/          # mode1.py (Send API fan-out), mode3.py (debate loop)
│   │   ├── models/          # MODEL_REGISTRY (FREE/PAID tiers)
│   │   ├── api/             # ws_battles.py (WebSocket), battles.py (REST + history)
│   │   ├── db/              # SQLAlchemy 2.0 async models, crud, session
│   │   └── core/            # config (pydantic-settings), rate_limit (per-IP daily)
│   ├── Dockerfile           # Multi-stage, non-root user, HEALTHCHECK
│   ├── cloudbuild.yaml      # GCP Cloud Build CI/CD pipeline
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/battle/  # BattleSetup, SplitScreen, DebateThread, VerdictCard
│   │   ├── lib/hooks/          # useBattle (useReducer state machine)
│   │   ├── pages/              # Landing, BattlePage, HistoryPage
│   │   └── lib/                # api.ts, types.ts
│   ├── firebase.json
│   └── .firebaserc
├── docker-compose.yml       # Local dev (Postgres + backend hot-reload)
└── docs/
    └── ARCHITECTURE.md
```

## Bias Mitigation

The judge always receives agent responses in randomised order. With `dual_pass: true`, two independent judge calls are made (one per ordering); the verdict is accepted only when both agree — otherwise a tie is declared.

## Rate Limiting

Per-IP daily counter (in-memory, auto-cleans stale days). Enforced on both the REST endpoint (`POST /api/battles`) and the WebSocket handler. Configurable via `PER_IP_DAILY_LIMIT` env var (default 20).

## Share-via-URL

Every completed battle is persisted to Postgres. Clicking "Copy Link" on the verdict card copies `https://yoursite.com/battle?id=<uuid>`. Anyone opening that URL sees the full battle — prompt, both responses, and the judge verdict.

---

## Build Phases

- [x] **Phase 1** — Backend skeleton (model registry, agents, judge, Mode 1 LangGraph, REST API)
- [x] **Phase 2** — WebSocket streaming + Postgres persistence
- [x] **Phase 3** — React frontend (split-screen, live token streaming, verdict radar chart)
- [x] **Phase 4** — Modes 2 & 3 (Strategy vs Strategy, Adversarial Debate)
- [x] **Phase 5** — Rate limiting, history page, share URLs, GCP Cloud Run + Firebase deploy
