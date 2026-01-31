from .agent import generate_mail
from .client import send_mail, send_mail_batch
from .base import Mail, Sender, PersonalizedMessage

__all__ = [
    # Mail Generation
    "generate_mail",

    # Send Mails
    "send_mail",
    "send_mail_batch",

    # Data Models
    "PersonalizedMessage",
    "Mail",
    "Sender"
]