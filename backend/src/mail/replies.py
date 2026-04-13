"""Shared reply-processing logic used by both IMAP polling and (legacy) webhooks."""

import re
from typing import Optional

from ..db.engine import get_cursor
from ..logger import logger


def extract_reply_html(html: str) -> str:
    """
    Extract only the user's actual reply from email HTML,
    stripping quoted/forwarded content from various email clients.
    """
    if not html:
        return ""

    # Common quote markers from different email clients
    quote_patterns = [
        r'<div[^>]*class="[^"]*gmail_quote[^"]*".*',
        r'<div[^>]*class="[^"]*yahoo_quoted[^"]*".*',
        r'<blockquote.*',
        r'<div[^>]*id="appendonsend".*',
        r'<div[^>]*id="divRplyFwdMsg".*',
        r'<hr[^>]*>.*On .* wrote:.*',
        r'<div[^>]*>On .* wrote:.*',
        r'-{3,}\s*Original Message\s*-{3,}.*',
        r'_{3,}\s*From:.*',
    ]

    result = html
    for pattern in quote_patterns:
        result = re.split(pattern, result, flags=re.IGNORECASE | re.DOTALL)[0]

    return result.strip()


def extract_reply_text(text: str) -> str:
    """
    Extract reply content from plain text email, stripping quoted lines.
    """
    if not text:
        return ""

    lines = text.splitlines()
    reply_lines: list[str] = []

    for line in lines:
        # Stop at common quote markers
        stripped = line.strip()
        if stripped.startswith(">"):
            break
        if re.match(r"^On .+ wrote:$", stripped):
            break
        if re.match(r"^-{3,}\s*Original Message", stripped, re.IGNORECASE):
            break
        if re.match(r"^_{3,}\s*From:", stripped, re.IGNORECASE):
            break
        reply_lines.append(line)

    return "\n".join(reply_lines).strip()


def mark_lead_replied(
    lead_id: str,
    subject: str,
    reply_content: str,
    gmail_message_id: Optional[str] = None,
) -> bool:
    """
    Mark a lead as replied and record the reply in the emails table.
    Idempotent: returns True if the lead was already marked as replied.
    """
    try:
        with get_cursor(commit=True) as cur:
            cur.execute(
                "SELECT id, campaign_id, has_replied FROM leads WHERE id = %s",
                (lead_id,),
            )
            lead = cur.fetchone()
            if not lead:
                logger.warning(f"Lead {lead_id} not found when recording reply")
                return False

            if lead["has_replied"]:
                return True

            cur.execute(
                """
                UPDATE leads
                SET has_replied = true,
                    status = 'replied',
                    updated_at = NOW()
                WHERE id = %s
                """,
                (lead_id,),
            )

            cur.execute(
                """
                INSERT INTO emails (lead_id, sequence_number, subject, body, status, message_id, sent_at)
                VALUES (%s, 0, %s, %s, 'received', %s, NOW())
                """,
                (lead_id, f"[REPLY] {subject}", reply_content, gmail_message_id),
            )

            logger.info(f"Lead {lead_id} marked as replied")
            return True

    except Exception as e:
        logger.error(f"Failed to mark lead {lead_id} as replied: {e}")
        return False
