from typing import List
from fastapi import APIRouter, HTTPException

from ..db import get_cursor
from ..scheduler.job import CAMPAIGN_EMAIL_RATE_LIMIT, RATE_LIMIT_WINDOW_MINUTES
from .models import CampaignCreate, CampaignResponse

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

@router.get("", response_model=List[CampaignResponse])
async def list_campaigns():
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, name, sender_name, sender_email, goal, 
                   follow_up_delay_minutes, max_follow_ups, status, 
                   created_at, updated_at 
            FROM campaigns 
            ORDER BY created_at DESC
        """)
        campaigns = cur.fetchall()
    return campaigns

@router.post("", response_model=CampaignResponse)
async def create_campaign(campaign: CampaignCreate):
    with get_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO campaigns (name, sender_name, sender_email, goal, follow_up_delay_minutes, max_follow_ups)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, name, sender_name, sender_email, goal, 
                      follow_up_delay_minutes, max_follow_ups, status, 
                      created_at, updated_at
        """, (
            campaign.name,
            campaign.sender_name,
            campaign.sender_email,
            campaign.goal,
            campaign.follow_up_delay_minutes,
            campaign.max_follow_ups
        ))
        new_campaign = cur.fetchone()
    return new_campaign

@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str):
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, name, sender_name, sender_email, goal, 
                   follow_up_delay_minutes, max_follow_ups, status, 
                   created_at, updated_at 
            FROM campaigns 
            WHERE id = %s
        """, (campaign_id,))
        campaign = cur.fetchone()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return campaign

@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str):
    with get_cursor(commit=True) as cur:
        cur.execute("DELETE FROM campaigns WHERE id = %s RETURNING id", (campaign_id,))
        deleted = cur.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return {"message": "Campaign deleted"}

@router.patch("/{campaign_id}/status", response_model=CampaignResponse)
async def update_campaign_status(campaign_id: str, action: str):
    """
    Toggle campaign status:
    - action='start': draft/paused -> active (also queues pending leads)
    - action='stop': active -> paused
    """
    if action not in ["start", "stop"]:
        raise HTTPException(status_code=400, detail="Action must be 'start' or 'stop'")
    
    with get_cursor(commit=True) as cur:
        # Get current status
        cur.execute("SELECT status FROM campaigns WHERE id = %s", (campaign_id,))
        result = cur.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        current_status = result["status"]
        
        # Determine new status
        if action == "start":
            if current_status not in ["draft", "paused"]:
                raise HTTPException(status_code=400, detail="Can only start campaigns in draft or paused status")
            
            # Check if campaign has any leads
            cur.execute("SELECT COUNT(*) as count FROM leads WHERE campaign_id = %s", (campaign_id,))
            lead_count = cur.fetchone()["count"]
            if lead_count == 0:
                raise HTTPException(status_code=400, detail="Cannot start a campaign with no leads. Add leads first.")
            
            new_status = "active"
            
            # Queue pending leads for immediate processing by setting next_email_at = NOW()
            # Only for leads that haven't been processed yet (pending status, no next_email_at)
            cur.execute("""
                UPDATE leads 
                SET next_email_at = NOW(), updated_at = NOW()
                WHERE campaign_id = %s 
                  AND status = 'pending'
                  AND next_email_at IS NULL
            """, (campaign_id,))
            
        else:  # stop
            if current_status != "active":
                raise HTTPException(status_code=400, detail="Can only stop campaigns in active status")
            new_status = "paused"
        
        # Update status
        cur.execute("""
            UPDATE campaigns 
            SET status = %s, updated_at = NOW()
            WHERE id = %s
            RETURNING id, name, sender_name, sender_email, goal,
                      follow_up_delay_minutes, max_follow_ups, status,
                      created_at, updated_at
        """, (new_status, campaign_id))
        
        updated_campaign = cur.fetchone()
    
    return updated_campaign


@router.get("/{campaign_id}/stats")
async def get_campaign_stats(campaign_id: str):
    """
    Get campaign statistics including:
    - emails_sent: Total emails sent (all time)
    - emails_target: Total emails to be sent (based on leads and max_follow_ups)
    - emails_in_window: Emails sent in the rate limit window
    - rate_limit: Max emails per window
    - rate_limit_window_minutes: Window duration
    - rate_limit_remaining: Emails that can still be sent in this window
    - rate_limit_resets_at: When the oldest email in window expires (ISO timestamp)
    """
    with get_cursor() as cur:
        # Check campaign exists and get max_follow_ups
        cur.execute("SELECT max_follow_ups FROM campaigns WHERE id = %s", (campaign_id,))
        campaign = cur.fetchone()
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        max_follow_ups = campaign["max_follow_ups"]
        
        # Get total sent emails count (all time)
        cur.execute("""
            SELECT COUNT(*) as count 
            FROM emails e
            JOIN leads l ON e.lead_id = l.id
            WHERE l.campaign_id = %s AND e.status IN ('sent', 'failed')
        """, (campaign_id,))
        emails_sent = cur.fetchone()["count"]
        
        # Calculate target emails based on lead status:
        # - replied/failed leads: their journey ended at current_sequence
        # - other leads: target is max_follow_ups
        cur.execute("""
            SELECT 
                COALESCE(SUM(
                    CASE 
                        WHEN status IN ('replied', 'failed') THEN current_sequence
                        ELSE %s
                    END
                ), 0) as target
            FROM leads
            WHERE campaign_id = %s
        """, (max_follow_ups, campaign_id))
        emails_target = cur.fetchone()["target"]
        
        # Get emails sent in rate limit window and oldest email timestamp
        cur.execute("""
            SELECT 
                COUNT(*) as count,
                MIN(e.sent_at) as oldest_sent_at
            FROM emails e
            JOIN leads l ON e.lead_id = l.id
            WHERE l.campaign_id = %s 
              AND e.status = 'sent'
              AND e.sent_at >= NOW() - INTERVAL '%s minutes'
        """, (campaign_id, RATE_LIMIT_WINDOW_MINUTES))
        window_result = cur.fetchone()
        emails_in_window = window_result["count"]
        oldest_in_window = window_result["oldest_sent_at"]
    
    rate_limit_remaining = max(0, CAMPAIGN_EMAIL_RATE_LIMIT - emails_in_window)
    
    # Calculate when rate limit resets (when oldest email falls out of window)
    rate_limit_resets_at = None
    if oldest_in_window and rate_limit_remaining == 0:
        from datetime import timedelta
        rate_limit_resets_at = oldest_in_window + timedelta(minutes=RATE_LIMIT_WINDOW_MINUTES)
    
    return {
        "emails_sent": emails_sent,
        "emails_target": int(emails_target),
        "emails_in_window": emails_in_window,
        "rate_limit": CAMPAIGN_EMAIL_RATE_LIMIT,
        "rate_limit_window_minutes": RATE_LIMIT_WINDOW_MINUTES,
        "rate_limit_remaining": rate_limit_remaining,
        "rate_limit_resets_at": rate_limit_resets_at.isoformat() if rate_limit_resets_at else None
    }
