import os, re, time, resend

from typing import List, Optional
from dotenv import load_dotenv

from .base import Mail
from ..logger import logger

load_dotenv()

# Set the API key for Resend
resend.api_key = os.getenv("RESEND_API_KEY")

# Setup domain
EMAIL_DOMAIN = os.getenv("EMAIL_DOMAIN", None)

if not EMAIL_DOMAIN:
    raise ValueError("Email Domain not found. Please add it in the .env file.")

# Retry configuration
MAX_RETRIES = 3

# Ensure that this is length of MAX_RETRIES and values are in seconds
RETRY_DELAYS = [1, 2, 4]  # Exponential backoff: 1s, 2s, 4s

# Check if the length of RETRY_DELAYS is equal to MAX_RETRIES
if len(RETRY_DELAYS) != MAX_RETRIES:
    raise ValueError("RETRY_DELAYS must be of length MAX_RETRIES")

def sanitize(name: str) -> str:
    # Keep only a-z, 0-9, and hyphens. Remove everything else.
    return re.sub(r'[^a-z0-9-]', '', name.lower().replace(" ", "-"))

def _build_reply_to(mail: Mail) -> List[str]:
    """
    Build reply_to list with sender email + tracking email (if configured).
    Tracking format: {lead_id}@{EMAIL_DOMAIN}
    """
    reply_to = [mail.sender.email]
    
    # Only add tracking email if lead_id is given
    if mail.lead_id:
        # Only use lead_id to stay under the 64-char RFC 5321 limit.
        # The database can look up the campaign_id from the lead_id later.
        tracking_email = f"{mail.lead_id}@{EMAIL_DOMAIN}"
        reply_to.append(tracking_email)
    
    return reply_to

def send_mail(mail: Mail):
    """
    Send a single email to the user with retry logic.

    Args:
        mail (Mail): The email to send.

    Returns:
        resend.Emails.SendResponse: The response from the email.
    
    Raises:
        Exception: If all retry attempts fail.
    """
    params: resend.Emails.SendParams = {
        "from": f"{mail.sender.name} <{sanitize(mail.sender.name)}@{EMAIL_DOMAIN}>",
        "to": [mail.to],
        "subject": mail.subject,
        "html": mail.body,
        "reply_to": _build_reply_to(mail)
    }

    last_exception = None
    
    for attempt in range(MAX_RETRIES):
        try:
            return resend.Emails.send(params)
        except Exception as e:
            last_exception = e
            logger.warning(
                f"Email send to {mail.to} failed (attempt {attempt + 1}/{MAX_RETRIES}): {str(e)}"
            )
            
            # Don't sleep after the last attempt
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAYS[attempt])
    
    logger.error(f"Email send failed after {MAX_RETRIES} attempts to {mail.to}: {str(last_exception)}")

    raise last_exception  # type: ignore

def send_mail_batch(
    mails: List[Mail], 
    idempotency_key: Optional[str] = None
):
    """
    Send a batch of emails to the users with retry logic.

    Args:
        mails (List[Mail]): The list of emails to send.
        idempotency_key (str | None): Optional idempotency key to prevent duplicate sends.
            For batch sends, use a single key that represents the whole batch (e.g., "job-run/123456789").

    Returns:
        resend.Emails.SendResponse: The response from the email.
    
    Raises:
        Exception: If all retry attempts fail.
    """
    params: List[resend.Emails.SendParams] = []

    for mail in mails:
        param: resend.Emails.SendParams = {
            "from": f"{mail.sender.name} <{sanitize(mail.sender.name)}@{EMAIL_DOMAIN}>",
            "to": [mail.to],
            "subject": mail.subject,
            "html": mail.body,
            "reply_to": _build_reply_to(mail)
        }
        params.append(param)
    
    # Prepare options with idempotency key if provided
    options: resend.Batch.SendOptions | None = None
    if idempotency_key:
        options = {"idempotency_key": idempotency_key}
    
    last_exception = None
    recipients = [m.to for m in mails]

    for attempt in range(MAX_RETRIES):
        try:
            return resend.Batch.send(params, options) if options else resend.Batch.send(params)
        except Exception as e:
            last_exception = e
            logger.warning(
                f"Batch email send failed (attempt {attempt + 1}/{MAX_RETRIES}): {str(e)}"
            )
            
            # Don't sleep after the last attempt
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAYS[attempt])
    
    logger.error(f"Batch email send failed after {MAX_RETRIES} attempts to {recipients}: {str(last_exception)}")

    raise last_exception  # type: ignore