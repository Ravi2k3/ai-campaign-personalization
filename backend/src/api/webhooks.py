import os, re, resend, json

from typing import Optional

from fastapi import APIRouter, Request, HTTPException
from svix.webhooks import Webhook, WebhookVerificationError
from dotenv import load_dotenv

from ..db import get_cursor
from ..logger import logger

load_dotenv()

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

# Resend webhook secret (from Resend Dashboard)
RESEND_WEBHOOK_SECRET = os.getenv("RESEND_WEBHOOK_SECRET", None)

if not RESEND_WEBHOOK_SECRET:
    raise ValueError("RESEND_WEBHOOK_SECRET is not set")

def extract_reply_html(html: str) -> str:
    """
    Extract only the user's actual reply from email HTML, 
    stripping quoted/forwarded content from various email clients.
    """
    if not html:
        return ""
    
    # Common quote markers from different email clients
    quote_patterns = [
        r'<div[^>]*class="[^"]*gmail_quote[^"]*".*',   # Gmail
        r'<div[^>]*class="[^"]*yahoo_quoted[^"]*".*',  # Yahoo
        r'<blockquote.*',                              # Standard blockquote
        r'<div[^>]*id="appendonsend".*',               # Outlook
        r'<div[^>]*id="divRplyFwdMsg".*',              # Outlook
        r'<hr[^>]*>.*On .* wrote:.*',                  # Generic "On ... wrote:"
        r'<div[^>]*>On .* wrote:.*',                   # Alternative format
        r'-{3,}\s*Original Message\s*-{3,}.*',         # "--- Original Message ---"
        r'_{3,}\s*From:.*',                            # Outlook separator
    ]
    
    result = html
    for pattern in quote_patterns:
        result = re.split(pattern, result, flags=re.IGNORECASE | re.DOTALL)[0]
    
    return result.strip()

def parse_tracking_email(email: str) -> Optional[str]:
    """
    Parse tracking email to extract lead_id.
    Format: {lead_id}@{EMAIL_DOMAIN}
    """
    # Extract local part: {lead_id}
    lead_id = email.split("@")[0]
    
    # Simple UUID validation (length check)
    if len(lead_id) != 36:
        return None
        
    return lead_id

def verify_webhook(
    payload: bytes, 
    headers: dict, 
    secret: str
) -> dict:
    """
    Verify the webhook signature from Resend using Svix.
    Returns the verified payload as dict, raises HTTPException on failure.
    """
    if not secret:
        # Skip verification in dev if no secret configured
        return json.loads(payload)
    
    wh = Webhook(secret)
    try:
        return wh.verify(payload, headers)
    except WebhookVerificationError as e:
        raise HTTPException(status_code=401, detail=f"Invalid webhook signature: {e}")

def mark_lead_replied(
    lead_id: str, 
    subject: str, 
    reply_content: str
) -> bool:
    """
    Mark lead as replied. Looks up campaign_id from the lead record.
    """
    try:
        with get_cursor(commit=True) as cur:
            # Look up campaign_id from the lead itself
            cur.execute("""
                SELECT id, campaign_id, has_replied 
                FROM leads 
                WHERE id = %s
            """, (lead_id,))
            
            lead = cur.fetchone()
            if not lead:
                logger.warning(f"[WEBHOOK] Lead {lead_id} not found")
                return False
                        
            if lead["has_replied"]:
                return True
            
            # Mark lead as replied
            cur.execute("""
                UPDATE leads 
                SET has_replied = true, 
                    status = 'replied',
                    updated_at = NOW()
                WHERE id = %s
            """, (lead_id,))
            
            # Record the reply
            cur.execute("""
                INSERT INTO emails (lead_id, sequence_number, subject, body, status, sent_at)
                VALUES (%s, 0, %s, %s, 'received', NOW())
            """, (lead_id, f"[REPLY] {subject}", reply_content))
            
            return True
            
    except Exception as e:
        logger.error(f"[WEBHOOK] Failed to mark lead as replied: {e}")
        return False

@router.post("/resend/inbound")
async def handle_resend_inbound(request: Request):
    """
    Webhook endpoint for Resend inbound emails (replies).
    
    When a lead replies to an email, Resend sends a webhook to this endpoint.
    We parse the tracking email from the 'to' field to identify the campaign/lead,
    then mark the lead as replied and record the reply content.
    
    Check README for setup of webhook.
    """
    # Get raw body and headers for Svix verification
    body = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }
    
    # Verify webhook signature
    payload = verify_webhook(body, headers, RESEND_WEBHOOK_SECRET) # type: ignore
    
    event_type = payload.get("type")
    email_data = payload.get("data", {})
        
    if event_type != "email.received":
        return {"status": "ignored", "reason": f"Event type {event_type} not handled"}
    
    # Check recipients for our tracking email
    recipients = email_data.get("to", []) + email_data.get("cc", [])
    
    matched_lead_id = None
    for recipient in recipients:
        parsed_id = parse_tracking_email(recipient)
        if parsed_id:
            matched_lead_id = parsed_id
            break
    
    if not matched_lead_id:
        return {"status": "ignored", "reason": "No tracking email found"}
    
    # Fetch full email content (webhook only sends metadata)
    email_id = email_data.get("email_id")
    
    try:
        full_email = resend.Emails.Receiving.get(email_id)
        reply_content = extract_reply_html(full_email.get("html", "") or full_email.get("text", "")) # type: ignore
    except Exception as e:
        logger.warning(f"[WEBHOOK] Could not fetch full email {email_id}: {e}")
        reply_content = "(Reply content unavailable)"
    
    # Mark lead as replied
    from_email = email_data.get("from", "")
    subject = email_data.get("subject", "")
    
    # Use the new signature
    success = mark_lead_replied(matched_lead_id, subject, reply_content)
    
    if success:
        return {
            "status": "processed",
            "lead_id": matched_lead_id,
            "from": from_email
        }
    else:
        return {
            "status": "error",
            "reason": "Failed to mark lead as replied"
        }
