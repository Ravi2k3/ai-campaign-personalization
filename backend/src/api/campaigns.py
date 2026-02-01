from typing import List
from fastapi import APIRouter, HTTPException

from ..db import get_cursor
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
    - action='start': draft -> active
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
            new_status = "active"
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
