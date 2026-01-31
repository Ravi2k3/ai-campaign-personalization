import os, resend
from typing import List
from dotenv import load_dotenv

from .base import Mail

load_dotenv()

# Set the API key for Resend
resend.api_key = os.getenv("RESEND_API_KEY")


def send_mail(mail: Mail):
    """
    Send a single email to the user.

    Args:
        mail (Mail): The email to send.

    Returns:
        resend.Emails.SendResponse: The response from the email.
    """
    params: resend.Emails.SendParams = {
        "from": f"{mail.sender.name} <{mail.sender.email}>",
        "to": [mail.to],
        "subject": mail.subject,
        "html": mail.body,
    }

    email = resend.Emails.send(params)
    return email

def send_mail_batch(mails: List[Mail]):
    """
    Send a batch of emails to the users.

    Args:
        mails (List[Mail]): The list of emails to send.

    Returns:
        resend.Emails.SendResponse: The response from the email.
    """
    params: List[resend.Emails.SendParams] = []

    for mail in mails:
        params.append({
            "from": f"{mail.sender.name} <{mail.sender.email}>",
            "to": [mail.to],
            "subject": mail.subject,
            "html": mail.body,
        })

    email = resend.Batch.send(params)
    return email