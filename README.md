<div align="center">

# ⚔️ AgentFaceOff

**Two AI agents. One prompt. One winner.**

A live LLM evaluation platform where models battle head-to-head in real time — with WebSocket streaming, an LLM judge, and a structured rubric verdict.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-agent--face--off.web.app-orange?style=for-the-badge)](https://agent-face-off.web.app)
[![Backend](https://img.shields.io/badge/Backend-Cloud%20Run-blue?style=for-the-badge&logo=googlecloud)](https://agentfaceoff-backend-ksknjekvfa-uc.a.run.app/health)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## What it does

AgentFaceOff sends the same prompt to two AI agents simultaneously, streams their responses live side-by-side, then calls an LLM judge to score each response on **accuracy, reasoning, clarity, and completeness** — and picks a winner.

### Battle Modes

| Mode | Description |
|------|-------------|
| **Model vs Model** | Same prompt, different models — streamed in parallel via LangGraph |
| **Strategy vs Strategy** | Same model, different system prompts (ReAct vs Plan-and-Execute, etc.) |
| **Adversarial Debate** | Multi-round critique and refinement between two agents |

### Features

- **Live token streaming** — responses appear character-by-character in a split-screen
- **Live web search** — Tavily fetches real-time context injected into both agents equally
- **Search image strip** — images from web results displayed above the response panes
- **Blind mode** — models hidden until you vote; see if your intuition matches the judge
- **Dual-pass judging** — two independent judge calls eliminate position bias
- **Follow-up chat** — continue the conversation with both agents after the verdict
- **Battle history** — every battle persisted to Postgres with share-via-URL
- **Leaderboard** — win/loss/tie stats per model across all battles
- **Auth** — JWT-based signup/login; history and leaderboard gated to logged-in users
- **Rate limiting** — per-IP daily cap to prevent abuse

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI · LangGraph 0.2 · Python 3.12 |
| **LLM Providers** | Groq (primary) · OpenRouter (extended models) |
| **Web Search** | Tavily API (parallel text + image queries) |
| **Frontend** | React 18 · Vite · TypeScript · Tailwind CSS |
| **Database** | PostgreSQL 16 · SQLAlchemy 2.0 async · asyncpg |
| **Auth** | JWT (python-jose) · bcrypt password hashing |
| **Deployment** | GCP Cloud Run (backend) · Firebase Hosting (frontend) · Cloud SQL |
| **CI/CD** | GCP Cloud Build · Artifact Registry |

---

## Model Lineup

| Model | Key | Provider | Tier |
|-------|-----|----------|------|
| Llama 4 Scout | `groq-llama-4-scout` | Groq | Free |
| Llama 3.1 8B | `groq-llama-3.1-8b` | Groq | Free |
| Llama 3.3 70B | `groq-llama-3.3-70b` | Groq | Free |
| DeepSeek R1 Distill 70B | `groq-deepseek-r1-distill-70b` | Groq | Free |
| Gemma 2 9B | `groq-gemma-2-9b` | Groq | Free |
| DeepSeek R1 | `deepseek-r1` | OpenRouter | Free |
| Qwen3 235B | `qwen3-235b` | OpenRouter | Free |

Default judge: **Llama 3.3 70B**

---

## Project Structure

```
agentfaceoff/
├── backend/
│   ├── app/
│   │   ├── agents/        # stream_agent_call, strategy system prompts
│   │   ├── judge/         # call_judge, Verdict schema, dual-pass bias mitigation
│   │   ├── graphs/        # mode1.py (Send API fan-out), mode3.py (debate loop)
│   │   ├── models/        # MODEL_REGISTRY with FREE/PAID tiers
│   │   ├── services/      # search.py — Tavily parallel text + image fetch
│   │   ├── api/           # ws_battles.py (WebSocket), battles.py (REST + history)
│   │   ├── auth/          # JWT router, bcrypt utils, schemas
│   │   ├── db/            # SQLAlchemy 2.0 async models, crud, session
│   │   └── core/          # config (pydantic-settings), rate limiter (per-IP)
│   ├── Dockerfile         # Multi-stage, non-root user, PORT env var
│   ├── cloudbuild.yaml    # GCP Cloud Build → Artifact Registry → Cloud Run
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/battle/   # BattleSetup, SplitScreen, DebateThread,
│   │   │                        # VerdictCard, FollowUpChat, AgentPane
│   │   ├── lib/hooks/           # useBattle (useReducer WS state machine)
│   │   │                        # useFollowUp (follow-up chat streaming)
│   │   ├── pages/               # Landing, BattlePage, HistoryPage,
│   │   │                        # LeaderboardPage, LoginPage, SignupPage
│   │   └── lib/                 # api.ts, types.ts, auth.ts, AuthContext
│   ├── firebase.json      # SPA rewrites + security headers + asset caching
│   └── .firebaserc
├── docker-compose.yml     # Local dev: Postgres + backend with hot-reload
├── setup-gcp.sh           # One-time GCP bootstrap script
└── docs/ARCHITECTURE.md
```

---

## Local Development

### Prerequisites

- Python 3.12+
- Node 20+
- Docker & Docker Compose
- A [Groq](https://console.groq.com) API key (free)

### 1. Start Postgres

```bash
docker compose up postgres -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Copy and fill in your keys
cp .env.example .env   # see Environment Variables section below
```

Create `backend/.env`:
```env
GROQ_API_KEY=gsk_...
DATABASE_URL=postgresql://agentfaceoff:agentfaceoff@localhost:5432/agentfaceoff
APP_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
JWT_SECRET=any-random-string-for-local-dev
TAVILY_API_KEY=tvly-...        # optional — web search
OPENROUTER_API_KEY=sk-or-...   # optional — extra models
```

```bash
uvicorn app.main:app --reload --port 8001
```

Health check: `curl http://localhost:8001/health`

### 3. Frontend

```bash
cd frontend
npm install

# Create frontend/.env.local
echo "VITE_API_URL=http://localhost:8001" > .env.local
echo "VITE_WS_URL=ws://localhost:8001" >> .env.local

npm run dev
```

Open **http://localhost:5173**

---

## Deploying to GCP

### One-time setup

```bash
gcloud auth login        # use your GCP account
bash setup-gcp.sh        # creates Cloud SQL, Secret Manager entries, IAM roles
```

The script will prompt for your API keys and a DB password — everything else is automated.

### Deploy backend

```bash
gcloud builds submit --config backend/cloudbuild.yaml
```

### Deploy frontend

```bash
# Get the Cloud Run URL
BACKEND=$(gcloud run services describe agentfaceoff-backend \
  --region=us-central1 --format='value(status.url)')

cd frontend
VITE_API_URL=$BACKEND VITE_WS_URL=${BACKEND/https/wss} npm run build
firebase deploy --only hosting
```

---

## Environment Variables

### Backend

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | **Yes** | Groq API key (`gsk_…`) |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | Secret for signing JWT tokens |
| `APP_ENV` | No | `development` or `production` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `TAVILY_API_KEY` | No | Enables live web search |
| `OPENROUTER_API_KEY` | No | Enables OpenRouter model tier |
| `MAX_CONCURRENT_BATTLES` | No | Default `5` |
| `PER_IP_DAILY_LIMIT` | No | Default `20` |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (no trailing slash) |
| `VITE_WS_URL` | Backend WebSocket URL (`ws://` or `wss://`) |

---

## How Judging Works

1. Both agents receive the same prompt simultaneously
2. Responses are streamed live over WebSocket
3. Once both finish, a judge LLM scores each response on four dimensions (0–10 each):
   - **Accuracy** — factual correctness
   - **Reasoning** — logical depth and structure
   - **Clarity** — readability and organisation
   - **Completeness** — coverage of the question
4. The agent with the higher total score wins. A tie is declared only when scores are exactly equal.
5. **Dual-pass mode** runs two independent judge calls with reversed agent order — the verdict is accepted only when both agree, eliminating position bias.

---

## Architecture Notes

- **WebSocket state machine** — `useBattle.ts` uses `useReducer` with phases: `idle → connecting → searching → streaming → judging → verdict`
- **LangGraph fan-out** — `mode1_graph` uses the Send API to dispatch both agents in parallel; `mode3_graph` implements the debate loop
- **Search fairness** — both agents always receive identical Tavily context; web search is not an advantage for either side
- **Score-based winner** — a backend `_correct_winner()` function overrides the LLM's declared winner if the numeric scores disagree
- **Task cancellation** — all three modes cancel pending LLM tasks on WebSocket disconnect to avoid orphaned API calls
