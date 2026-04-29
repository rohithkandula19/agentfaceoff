from collections import defaultdict
from datetime import date
import asyncio
import logging

from fastapi import HTTPException, Request

from app.core.config import settings

logger = logging.getLogger(__name__)

_counts: dict[tuple[str, date], int] = defaultdict(int)
_lock = asyncio.Lock()


def _client_ip(request: Request) -> str:
    # Respect X-Forwarded-For when behind a load balancer / Cloud Run
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def enforce_ip_limit(request: Request) -> None:
    """FastAPI dependency: raises 429 if IP has exceeded the daily battle limit."""
    ip = _client_ip(request)
    today = date.today()

    async with _lock:
        # Drop stale entries from previous days to prevent unbounded growth
        stale = [k for k in list(_counts) if k[1] < today]
        for k in stale:
            del _counts[k]

        key = (ip, today)
        if _counts[key] >= settings.per_ip_daily_limit:
            logger.warning("Rate limit hit for IP %s (%d battles today)", ip, _counts[key])
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Daily limit of {settings.per_ip_daily_limit} battles reached for your IP. "
                    "Try again tomorrow."
                ),
            )
        _counts[key] += 1


async def check_ip_limit_ws(ip: str) -> bool:
    """WebSocket variant — returns False (and logs) instead of raising."""
    today = date.today()
    async with _lock:
        stale = [k for k in list(_counts) if k[1] < today]
        for k in stale:
            del _counts[k]

        key = (ip, today)
        if _counts[key] >= settings.per_ip_daily_limit:
            logger.warning("WS rate limit hit for IP %s", ip)
            return False
        _counts[key] += 1
        return True
