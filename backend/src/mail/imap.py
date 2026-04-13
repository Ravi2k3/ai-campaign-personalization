"""Gmail IMAP reply detection via XOAUTH2 authentication."""

import base64
import email
import imaplib
from datetime import datetime, timedelta, timezone
from email.header import decode_header
from typing import Optional

from ..auth.tokens import get_valid_access_token
from ..db.engine import get_cursor
from ..logger import logger

GMAIL_IMAP_HOST = "imap.gmail.com"
GMAIL_IMAP_PORT = 993


def _build_xoauth2_string(user_email: str, access_token: str) -> bytes:
    auth_string = f"user={user_email}\x01auth=Bearer {access_token}\x01\x01"
    return auth_string.encode()


def _decode_header_value(raw: Optional[str]) -> str:
    """Decode an email header that may be MIME-encoded."""
    if not raw:
        return ""
    decoded_parts = decode_header(raw)
    parts: list[str] = []
    for part, charset in decoded_parts:
        if isinstance(part, bytes):
            parts.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            parts.append(part)
    return " ".join(parts)


def _get_lead_emails_for_user(user_id: str) -> dict[str, list[dict]]:
    """
    Fetch all lead email addresses for active campaigns of this user,
    along with the message_ids of emails we sent to them.

    Returns:
        Dict mapping lead email address -> list of {lead_id, message_id, sequence_number}
    """
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                l.id as lead_id,
                l.email as lead_email,
                e.message_id,
                e.sequence_number
            FROM leads l
            JOIN campaigns c ON l.campaign_id = c.id
            LEFT JOIN emails e ON e.lead_id = l.id AND e.status = 'sent'
            WHERE c.user_id = %s
              AND c.status = 'active'
              AND l.has_replied = false
              AND l.status NOT IN ('replied', 'failed')
            ORDER BY l.email, e.sequence_number
            """,
            (user_id,),
        )
        rows = cur.fetchall()

    lead_map: dict[str, list[dict]] = {}
    for row in rows:
        addr = row["lead_email"].lower()
        if addr not in lead_map:
            lead_map[addr] = []
        if row["message_id"]:
            lead_map[addr].append({
                "lead_id": str(row["lead_id"]),
                "message_id": row["message_id"],
                "sequence_number": row["sequence_number"],
            })

    return lead_map


def _get_earliest_campaign_start(user_id: str) -> Optional[datetime]:
    """Get the earliest active campaign start date to scope the IMAP search."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT MIN(c.updated_at) as earliest
            FROM campaigns c
            WHERE c.user_id = %s AND c.status = 'active'
            """,
            (user_id,),
        )
        row = cur.fetchone()
    if row and row["earliest"]:
        return row["earliest"]
    return None


def check_replies_for_user(user_id: str, user_email: str) -> list[dict]:
    """
    Connect to the user's Gmail via IMAP XOAUTH2 and check for replies
    from lead email addresses. Matches replies using In-Reply-To headers.

    Returns:
        List of dicts: {lead_id, subject, body, gmail_message_id}
    """
    lead_map = _get_lead_emails_for_user(user_id)
    if not lead_map:
        return []

    earliest_start = _get_earliest_campaign_start(user_id)
    if not earliest_start:
        return []

    # Search IMAP since a day before earliest campaign start
    since_date = (earliest_start - timedelta(days=1)).strftime("%d-%b-%Y")

    access_token = get_valid_access_token(user_id)
    auth_string = _build_xoauth2_string(user_email, access_token)

    imap: Optional[imaplib.IMAP4_SSL] = None
    replies: list[dict] = []

    try:
        imap = imaplib.IMAP4_SSL(GMAIL_IMAP_HOST, GMAIL_IMAP_PORT)
        imap.authenticate("XOAUTH2", lambda _: auth_string)
        imap.select("INBOX", readonly=True)

        # Build IMAP search: emails FROM any lead address, since campaign start
        # IMAP OR syntax: (OR (FROM "a") (FROM "b")) for 2 addresses,
        # nested for more: (OR (OR (FROM "a") (FROM "b")) (FROM "c"))
        lead_addrs = list(lead_map.keys())

        if len(lead_addrs) == 1:
            from_criteria = f'FROM "{lead_addrs[0]}"'
        else:
            # Build nested OR tree
            from_criteria = f'FROM "{lead_addrs[0]}"'
            for addr in lead_addrs[1:]:
                from_criteria = f'OR ({from_criteria}) (FROM "{addr}")'

        search_query = f"({from_criteria} SINCE {since_date})"

        status, msg_nums = imap.search(None, search_query)
        if status != "OK" or not msg_nums[0]:
            return []

        msg_id_list = msg_nums[0].split()
        logger.info(
            f"IMAP found {len(msg_id_list)} candidate messages for user {user_id}"
        )

        # Build a lookup of our sent message_ids to lead info
        sent_msg_lookup: dict[str, dict] = {}
        for addr, entries in lead_map.items():
            for entry in entries:
                if entry["message_id"]:
                    sent_msg_lookup[entry["message_id"]] = {
                        "lead_id": entry["lead_id"],
                        "lead_email": addr,
                    }

        for num in msg_id_list:
            status, data = imap.fetch(num, "(RFC822.HEADER BODY[TEXT])")
            if status != "OK" or not data:
                continue

            # Parse headers
            header_data = None
            body_data = b""
            for part in data:
                if isinstance(part, tuple):
                    if b"HEADER" in part[0]:
                        header_data = part[1]
                    elif b"TEXT" in part[0]:
                        body_data = part[1]

            if not header_data:
                continue

            msg = email.message_from_bytes(header_data)
            in_reply_to = msg.get("In-Reply-To", "").strip()
            references = msg.get("References", "").strip()
            from_addr = email.utils.parseaddr(msg.get("From", ""))[1].lower()
            subject = _decode_header_value(msg.get("Subject"))
            gmail_message_id = msg.get("Message-ID", "").strip()

            # Match by In-Reply-To header
            matched_lead = sent_msg_lookup.get(in_reply_to)

            # Fallback: check References header chain
            if not matched_lead and references:
                for ref in references.split():
                    matched_lead = sent_msg_lookup.get(ref.strip())
                    if matched_lead:
                        break

            # Fallback: match by sender email if they're a known lead
            if not matched_lead and from_addr in lead_map and lead_map[from_addr]:
                matched_lead = {
                    "lead_id": lead_map[from_addr][0]["lead_id"],
                    "lead_email": from_addr,
                }

            if matched_lead:
                body_text = body_data.decode("utf-8", errors="replace") if body_data else ""
                replies.append({
                    "lead_id": matched_lead["lead_id"],
                    "subject": subject,
                    "body": body_text,
                    "gmail_message_id": gmail_message_id,
                })

    except imaplib.IMAP4.error as e:
        logger.error(f"IMAP error for user {user_id}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error checking replies for user {user_id}: {e}")
    finally:
        if imap:
            try:
                imap.logout()
            except Exception:
                pass

    return replies
