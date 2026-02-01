from typing import List
from fastapi import APIRouter, HTTPException

from ..db import get_cursor
from .models import (
    LeadCreate, 
    LeadBulkCreate, 
    LeadResponse, 
    LeadUpdate,
    LeadDetailResponse,
    EmailActivityResponse
)

# Router for lead list
router = APIRouter(prefix="/campaigns/{campaign_id}/leads", tags=["leads"])

# Router for lead details
detail_router = APIRouter(prefix="/leads", tags=["leads"])

@router.get("", response_model=List[LeadResponse])
async def list_leads(campaign_id: str):
    with get_cursor() as cur:
        cur.execute("""
            SELECT id, campaign_id, email, first_name, last_name, company, 
                   title, notes, status, has_replied, current_sequence, created_at
            FROM leads 
            WHERE campaign_id = %s
            ORDER BY created_at DESC
        """, (campaign_id,))
        leads = cur.fetchall()
    return leads

@router.post("", response_model=LeadResponse)
async def create_lead(campaign_id: str, lead: LeadCreate):
    with get_cursor(commit=True) as cur:
        # Check if campaign is completed
        cur.execute("SELECT status FROM campaigns WHERE id = %s", (campaign_id,))
        campaign = cur.fetchone()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        if campaign["status"] == "completed":
            raise HTTPException(status_code=400, detail="Cannot add leads to a completed campaign")
        
        # Check if lead already exists in this campaign
        cur.execute(
            "SELECT id FROM leads WHERE campaign_id = %s AND email = %s",
            (campaign_id, lead.email)
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Lead with this email already exists in this campaign")
        
        cur.execute("""
            INSERT INTO leads (campaign_id, email, first_name, last_name, company, title, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, campaign_id, email, first_name, last_name, company, 
                      title, notes, status, has_replied, current_sequence, created_at
        """, (
            campaign_id,
            lead.email,
            lead.first_name,
            lead.last_name,
            lead.company,
            lead.title,
            lead.notes
        ))
        new_lead = cur.fetchone()
    return new_lead

@router.post("/bulk", response_model=List[LeadResponse])
async def bulk_create_leads(campaign_id: str, data: LeadBulkCreate):
    if not data.leads:
        raise HTTPException(status_code=400, detail="No leads provided")
    
    created_leads = []
    with get_cursor(commit=True) as cur:
        # Check if campaign is completed
        cur.execute("SELECT status FROM campaigns WHERE id = %s", (campaign_id,))
        campaign = cur.fetchone()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        if campaign["status"] == "completed":
            raise HTTPException(status_code=400, detail="Cannot add leads to a completed campaign")
        
        # Get existing emails in this campaign
        cur.execute(
            "SELECT email FROM leads WHERE campaign_id = %s",
            (campaign_id,)
        )
        existing_emails = {row["email"] for row in cur.fetchall()}
        
        # Also track emails within this batch to avoid duplicates in the input
        seen_emails = set()
        
        for lead in data.leads:
            # Skip if email already exists in campaign or already seen in this batch
            if lead.email in existing_emails or lead.email in seen_emails:
                continue
            
            seen_emails.add(lead.email)
            
            cur.execute("""
                INSERT INTO leads (campaign_id, email, first_name, last_name, company, title, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, campaign_id, email, first_name, last_name, company, 
                          title, notes, status, has_replied, current_sequence, created_at
            """, (
                campaign_id,
                lead.email,
                lead.first_name,
                lead.last_name,
                lead.company,
                lead.title,
                lead.notes
            ))
            created_leads.append(cur.fetchone())
    
    return created_leads

@router.delete("/{lead_id}")
async def delete_lead(campaign_id: str, lead_id: str):
    with get_cursor(commit=True) as cur:
        cur.execute(
            "DELETE FROM leads WHERE id = %s AND campaign_id = %s RETURNING id",
            (lead_id, campaign_id)
        )
        deleted = cur.fetchone()
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return {"message": "Lead deleted"}

@detail_router.get("/{lead_id}", response_model=LeadDetailResponse)
async def get_lead_detail(lead_id: str):
    """
    Get detailed information about a specific lead including campaign context
    """
    with get_cursor() as cur:
        cur.execute("""
            SELECT 
                l.id, l.campaign_id, l.email, l.first_name, l.last_name, 
                l.company, l.title, l.notes, l.status, l.has_replied, 
                l.current_sequence, l.next_email_at, l.created_at, l.updated_at,
                c.name as campaign_name
            FROM leads l
            JOIN campaigns c ON l.campaign_id = c.id
            WHERE l.id = %s
        """, (lead_id,))
        lead = cur.fetchone()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return lead

@detail_router.get("/{lead_id}/activity", response_model=List[EmailActivityResponse])
async def get_lead_activity(lead_id: str, campaign_id: str):
    """
    Get email activity for a specific lead in a specific campaign
    """
    with get_cursor() as cur:
        # Verify lead belongs to campaign
        cur.execute(
            "SELECT id FROM leads WHERE id = %s AND campaign_id = %s",
            (lead_id, campaign_id)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Lead not found in this campaign")
        
        # Get email activity
        cur.execute("""
            SELECT id, sequence_number, subject, body, status, sent_at, created_at
            FROM emails
            WHERE lead_id = %s
            ORDER BY created_at DESC
        """, (lead_id,))
        emails = cur.fetchall()
    
    return emails

@detail_router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(lead_id: str, update: LeadUpdate):
    """
    Update lead information (notes, status, has_replied)
    """
    # Build dynamic update query
    updates = []
    params = []
    
    if update.notes is not None:
        updates.append("notes = %s")
        params.append(update.notes)
    
    if update.has_replied is not None:
        updates.append("has_replied = %s")
        params.append(str(update.has_replied))
    
    if update.status is not None:
        updates.append("status = %s")
        params.append(update.status)
    
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    updates.append("updated_at = NOW()")
    params.append(lead_id)
    
    with get_cursor(commit=True) as cur:
        cur.execute(f"""
            UPDATE leads
            SET {', '.join(updates)}
            WHERE id = %s
            RETURNING id, campaign_id, email, first_name, last_name, company,
                      title, notes, status, has_replied, current_sequence, created_at
        """, params)
        updated_lead = cur.fetchone()
    
    if not updated_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return updated_lead