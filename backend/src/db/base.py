from enum import Enum

from .engine import get_cursor
from ..logger import logger

# Status Enums
class Status:
    class CampaignStatus(str, Enum):
        DRAFT = "draft"
        ACTIVE = "active"
        PAUSED = "paused"
        COMPLETED = "completed"

    class LeadStatus(str, Enum):
        PENDING = "pending"       # Waiting to be processed
        PROCESSING = "processing" # Currently being processed (locked)
        ACTIVE = "active"         # Email sent, waiting for follow-up
        REPLIED = "replied"       # Lead has replied
        COMPLETED = "completed"   # All follow-ups sent
        FAILED = "failed"         # Processing failed

    class EmailStatus(str, Enum):
        SENT = "sent"
        FAILED = "failed"

# Table Schemas
CAMPAIGNS_TABLE = """
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    goal TEXT NOT NULL,
    follow_up_delay_minutes INTEGER DEFAULT 2880,
    max_follow_ups INTEGER DEFAULT 3,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
"""

LEADS_TABLE = """
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    company TEXT,
    title TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    has_replied BOOLEAN DEFAULT FALSE,
    current_sequence INTEGER DEFAULT 0,
    next_email_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, email)
);
"""

EMAILS_TABLE = """
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL DEFAULT 0,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    resend_id TEXT,
    attempts INTEGER DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_next_email_at ON leads(next_email_at);
CREATE INDEX IF NOT EXISTS idx_leads_locked_at ON leads(locked_at);
CREATE INDEX IF NOT EXISTS idx_emails_lead_id ON emails(lead_id);
"""

def init_db() -> bool:
    """
    Initialize database tables if they don't exist.
    Creates: campaigns, leads, emails tables with indexes.
    
    Returns:
        True if successful, False otherwise.
    """
    try:
        with get_cursor(commit=True) as cur:
            cur.execute(CAMPAIGNS_TABLE)
            cur.execute(LEADS_TABLE)
            cur.execute(EMAILS_TABLE)
            cur.execute(INDEXES)
        
        logger.info("Database tables initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        return False