"""
Tavily web-search service.

Fetches real-time search results and formats them as LLM-ready context
that gets prepended to the user's prompt before both agents answer.
Also returns image URLs for display in the UI.
"""

import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


async def build_search_context(
    query: str,
    max_results: int = 5,
) -> tuple[Optional[str], list[str]]:
    """
    Search the web with Tavily.

    Returns:
        (context_str, image_urls)
        - context_str: LLM-ready text block to prepend to the prompt, or None on failure
        - image_urls: list of image URLs to show in the UI (may be empty)
    """
    if not settings.tavily_api_key:
        logger.warning("web_search requested but TAVILY_API_KEY is not set")
        return None, []

    try:
        import asyncio
        from tavily import AsyncTavilyClient  # type: ignore[import]

        client = AsyncTavilyClient(api_key=settings.tavily_api_key)

        # Run text search and image search in parallel with a hard timeout
        async def _text_search() -> dict:
            return await client.search(
                query=query,
                search_depth="basic",
                max_results=max_results,
                include_answer=True,
                include_images=False,
            )

        async def _image_search() -> list:
            resp = await client.search(
                query=query,
                search_depth="basic",
                max_results=3,
                include_answer=False,
                include_images=True,
            )
            return resp.get("images") or []

        try:
            text_resp, raw_images = await asyncio.wait_for(
                asyncio.gather(_text_search(), _image_search()),
                timeout=4.0,
            )
        except asyncio.TimeoutError:
            logger.warning("Tavily search timed out after 4s — proceeding without search context")
            return None, []

        # ── Text context for the LLMs ──────────────────────────────────────
        parts: list[str] = []

        quick_answer: str = text_resp.get("answer") or ""
        if quick_answer:
            parts.append(f"Summary: {quick_answer}")

        results: list[dict] = text_resp.get("results") or []
        if results:
            parts.append("\nTop search results:")
            for i, r in enumerate(results[:max_results], 1):
                title   = r.get("title", "").strip()
                url     = r.get("url", "").strip()
                snippet = (r.get("content") or "").strip()[:500]
                parts.append(f"{i}. {title}\n   {url}\n   {snippet}")

        context_str: Optional[str] = None
        if parts:
            context_block = "\n".join(parts)
            context_str = (
                "[WEB SEARCH RESULTS — use these to inform your answer]\n"
                f"{context_block}\n"
                "[END OF SEARCH RESULTS]\n\n"
                "Now answer the following question using the search results above as context:\n"
            )

        # ── Image URLs for the UI ──────────────────────────────────────────
        image_urls: list[str] = []
        for img in raw_images:
            if isinstance(img, str):
                image_urls.append(img)
            elif isinstance(img, dict) and img.get("url"):
                image_urls.append(img["url"])

        return context_str, image_urls[:8]

    except Exception as exc:
        logger.warning("Tavily search failed (battle will continue without search): %s", exc)
        return None, []
