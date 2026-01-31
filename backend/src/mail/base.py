from pydantic import BaseModel

class PersonalizedMessage(BaseModel):
    subject: str
    body: str

class Mail(BaseModel):
    sender: str
    to: str
    subject: str
    body: str