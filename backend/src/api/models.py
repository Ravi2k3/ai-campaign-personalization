from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

# Request/Response models for campaigns
class CampaignCreate(BaseModel):
    name: str
    sender_name: str
    sender_email: str
    goal: Optional[str] = None
    follow_up_delay_minutes: int = 2880
    max_follow_ups: int = 3

class CampaignResponse(BaseModel):
    id: str
    name: str
    sender_name: str
    sender_email: str
    goal: Optional[str]
    follow_up_delay_minutes: int
    max_follow_ups: int
    status: str
    created_at: datetime
    updated_at: datetime

# Request/Response models for leads
class LeadCreate(BaseModel):
    email: str
    first_name: str
    last_name: str
    company: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None

class LeadBulkCreate(BaseModel):
    leads: List[LeadCreate]

class LeadResponse(BaseModel):
    id: str
    campaign_id: str
    email: str
    first_name: str
    last_name: str
    company: Optional[str]
    title: Optional[str]
    notes: Optional[str]
    status: str
    has_replied: bool
    current_sequence: int
    created_at: datetime
