from pydantic import BaseModel
from typing import Optional

class PersonalizedMessage(BaseModel):
    subject: str
    body: str

class Sender(BaseModel):
    name: str
    email: str

class Mail(BaseModel):
    sender: Sender
    to: str
    subject: str
    body: str
    lead_id: Optional[str] = None