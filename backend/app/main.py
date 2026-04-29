import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.battles import router as battles_router
from app.api.ws_battles import router as ws_router
from app.api.upload import router as upload_router
from app.auth.router import router as auth_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AgentFaceOff starting up (env=%s)", settings.app_env)

    # Always run create_all — SQLAlchemy skips existing tables (checkfirst=True)
    try:
        from app.db.session import create_tables
        await create_tables()
    except Exception as exc:
        if settings.app_env == "development":
            logger.warning("DB table creation skipped (is Postgres running?): %s", exc)
        else:
            logger.error("FATAL: could not create DB tables: %s", exc)
            raise

    yield
    logger.info("AgentFaceOff shutting down")


app = FastAPI(
    title="AgentFaceOff API",
    description="LLM evaluation platform — two agents, one prompt, one winner.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(battles_router)
app.include_router(ws_router)
app.include_router(upload_router)
app.include_router(auth_router)


@app.get("/health", tags=["meta"])
async def health_check():
    return {"status": "ok", "version": "0.2.0", "env": settings.app_env}
