"""Endpoints for uploading a product-context document to a campaign."""

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..auth import get_current_user
from ..db import get_cursor
from ..documents import (
    parse_document,
    DocumentParseError,
    summarize_to_brief,
    BriefSummarizationError,
)
from ..logger import logger
from .models import ProductDocumentResponse

router = APIRouter(prefix="/campaigns/{campaign_id}/document", tags=["documents"])

# Accept the formats LlamaParse handles reliably. Extend cautiously.
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".txt", ".md"}
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


def _verify_mutable_campaign(cur: Any, campaign_id: str, user_id: str) -> dict[str, Any]:
    """Ensure the campaign exists, is owned by the caller, and is still editable."""
    cur.execute(
        "SELECT id, status FROM campaigns WHERE id = %s AND user_id = %s",
        (campaign_id, user_id),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if row["status"] not in ("draft", "paused"):
        raise HTTPException(
            status_code=400,
            detail="Product documents can only be modified on draft or paused campaigns.",
        )
    return row


@router.post("", response_model=ProductDocumentResponse)
async def upload_document(
    campaign_id: str,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(get_current_user),
):
    """
    Upload a product-context document (PDF / DOCX / PPTX / TXT / MD).
    The file is parsed via LlamaParse, summarised into a 300-500 word
    product brief, and stored on the campaign. The original file is not
    persisted.
    """
    # Validate file name and extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    import os as _os
    ext = _os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}.",
        )

    # Read and validate size
    body = await file.read()
    if len(body) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(body) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {MAX_FILE_BYTES // (1024 * 1024)} MB.",
        )

    # Ownership + mutability check before incurring any upstream cost
    with get_cursor() as cur:
        _verify_mutable_campaign(cur, campaign_id, user["id"])

    # Parse the document via LlamaParse
    try:
        markdown = await parse_document(body, file.filename)
    except DocumentParseError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected parse error for {file.filename}: {e}")
        raise HTTPException(status_code=502, detail="Document parsing service is unavailable.")

    # Summarize to product brief
    try:
        brief = await summarize_to_brief(markdown)
    except BriefSummarizationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected summarization error: {e}")
        raise HTTPException(status_code=502, detail="Summarization service is unavailable.")

    # Persist brief on the campaign. Re-check mutability inside the write
    # transaction to guard against concurrent status changes.
    with get_cursor(commit=True) as cur:
        _verify_mutable_campaign(cur, campaign_id, user["id"])
        cur.execute(
            """
            UPDATE campaigns
            SET product_context = %s,
                product_document_name = %s,
                updated_at = NOW()
            WHERE id = %s AND user_id = %s
            """,
            (brief, file.filename, campaign_id, user["id"]),
        )

    word_count = len(brief.split())
    return ProductDocumentResponse(
        document_name=file.filename,
        brief=brief,
        word_count=word_count,
    )


@router.delete("")
async def delete_document(
    campaign_id: str,
    user: dict[str, Any] = Depends(get_current_user),
):
    """Clear the product document and brief from the campaign."""
    with get_cursor(commit=True) as cur:
        _verify_mutable_campaign(cur, campaign_id, user["id"])
        cur.execute(
            """
            UPDATE campaigns
            SET product_context = NULL,
                product_document_name = NULL,
                updated_at = NOW()
            WHERE id = %s AND user_id = %s
            """,
            (campaign_id, user["id"]),
        )
    return {"message": "Document cleared"}
