from typing import List
from fastapi import APIRouter, HTTPException

from ..db import get_cursor
from .models import LeadCreate, LeadBulkCreate, LeadResponse

router = APIRouter(prefix="/campaigns/{campaign_id}/leads", tags=["leads"])

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
        for lead in data.leads:
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