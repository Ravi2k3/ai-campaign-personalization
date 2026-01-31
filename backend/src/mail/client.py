import os, time, resend

from typing import List
from dotenv import load_dotenv

from .base import Mail
from ..logger import logger

load_dotenv()

# Set the API key for Resend
resend.api_key = os.getenv("RESEND_API_KEY")

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAYS = [1, 2, 4]  # Exponential backoff: 1s, 2s, 4s

def sanitize(name: str) -> str:
    """
    Convert string to lowercase and replace spaces with hyphens.
    """
    return name.lower().replace(" ", "-")

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
        "from": f"{mail.sender.name} <{sanitize(mail.sender.name)}@resend.dev>",
        "to": [mail.to],
        "subject": mail.subject,
        "html": mail.body,
        "reply_to": mail.sender.email
    }

    last_exception = None
    
    for attempt in range(MAX_RETRIES):
        try:
            logger.info(f"Sending email to {mail.to} (attempt {attempt + 1}/{MAX_RETRIES})")
            email = resend.Emails.send(params)
            logger.info(f"Email sent successfully to {mail.to}, id: {email.id if hasattr(email, 'id') else 'N/A'}")
            return email
        except Exception as e:
            last_exception = e
            logger.warning(
                f"Email send failed on attempt {attempt + 1}/{MAX_RETRIES}: {str(e)}"
            )
            
            # Don't sleep after the last attempt
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[attempt]
                logger.info(f"Retrying in {delay} seconds...")
                time.sleep(delay)
    
    logger.error(f"Email send failed after {MAX_RETRIES} attempts to {mail.to}: {str(last_exception)}")
    raise last_exception  # type: ignore

def send_mail_batch(mails: List[Mail]):
    """
    Send a batch of emails to the users with retry logic.

    Args:
        mails (List[Mail]): The list of emails to send.

    Returns:
        resend.Emails.SendResponse: The response from the email.
    
    Raises:
        Exception: If all retry attempts fail.
    """
    params: List[resend.Emails.SendParams] = []

    for mail in mails:
        params.append({
            "from": f"{mail.sender.name} <{sanitize(mail.sender.name)}@resend.dev>",
            "to": [mail.to],
            "subject": mail.subject,
            "html": mail.body,
            "reply_to": mail.sender.email
        })

    last_exception = None
    recipients = [m.to for m in mails]
    
    for attempt in range(MAX_RETRIES):
        try:
            logger.info(f"Sending batch email to {len(mails)} recipients (attempt {attempt + 1}/{MAX_RETRIES})")
            email = resend.Batch.send(params)
            logger.info(f"Batch email sent successfully to {len(mails)} recipients")
            return email
        except Exception as e:
            last_exception = e
            logger.warning(
                f"Batch email send failed on attempt {attempt + 1}/{MAX_RETRIES}: {str(e)}"
            )
            
            # Don't sleep after the last attempt
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_DELAYS[attempt]
                logger.info(f"Retrying in {delay} seconds...")
                time.sleep(delay)
    
    logger.error(f"Batch email send failed after {MAX_RETRIES} attempts to {recipients}: {str(last_exception)}")
    raise last_exception  # type: ignore