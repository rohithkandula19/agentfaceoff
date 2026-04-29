"""
Text extraction endpoint for document and URL context.

Supports:
  - .txt / .md  — read directly
  - .pdf        — PyMuPDF (fitz)
  - .docx       — python-docx
  - URL         — httpx fetch + strip tags
"""

import logging
import re
from io import BytesIO

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["upload"])

MAX_CHARS = 12_000  # ~3k tokens, safe for all models


def _strip_html(html: str) -> str:
    text = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


@router.post("/upload/file")
async def upload_file(file: UploadFile = File(...)):
    """Extract text from an uploaded file (.txt, .pdf, .docx)."""
    filename = (file.filename or "").lower()
    raw = await file.read()

    try:
        if filename.endswith(".pdf"):
            try:
                import fitz  # PyMuPDF
            except ImportError:
                raise HTTPException(status_code=422, detail="PDF support not installed (pip install pymupdf)")
            doc = fitz.open(stream=raw, filetype="pdf")
            text = "\n\n".join(page.get_text() for page in doc)

        elif filename.endswith(".docx"):
            try:
                from docx import Document
            except ImportError:
                raise HTTPException(status_code=422, detail="DOCX support not installed (pip install python-docx)")
            doc = Document(BytesIO(raw))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())

        elif filename.endswith((".txt", ".md", ".rst", ".csv")):
            text = raw.decode("utf-8", errors="replace")

        else:
            raise HTTPException(status_code=422, detail=f"Unsupported file type: {filename}")

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("File extraction failed: %s", exc)
        raise HTTPException(status_code=422, detail=f"Could not extract text: {exc}")

    text = text[:MAX_CHARS]
    return {"text": text, "chars": len(text), "filename": file.filename}


class UrlRequest(BaseModel):
    url: str


@router.post("/upload/url")
async def upload_url(req: UrlRequest):
    """Fetch a URL and extract its text content."""
    if not req.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="URL must start with http:// or https://")

    try:
        import httpx
    except ImportError:
        raise HTTPException(status_code=422, detail="httpx not installed")

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            response = await client.get(
                req.url,
                headers={"User-Agent": "AgentFaceOff/1.0 (context-extractor)"},
            )
            response.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not fetch URL: {exc}")

    content_type = response.headers.get("content-type", "")
    if "text/html" in content_type or "text/plain" in content_type:
        text = _strip_html(response.text)
    else:
        raise HTTPException(status_code=422, detail=f"Unsupported content type: {content_type}")

    text = text[:MAX_CHARS]
    return {"text": text, "chars": len(text), "url": req.url}
