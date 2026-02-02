import asyncio, functools, hashlib

from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple

from psycopg2.extras import execute_batch, execute_values

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ..db import get_cursor
from ..mail.agent import generate_mail
from ..mail.client import send_mail_batch
from ..mail.base import Mail, Sender
from ..logger import logger

# Scheduler instance
scheduler: AsyncIOScheduler | None = None

# Lock timeout in minutes (if a lead is locked for longer, consider it stale)
LOCK_TIMEOUT_MINUTES = 5

# How often to run the job (in seconds)
JOB_INTERVAL_SECONDS = 60

# Max leads to process per job run
MAX_LEADS_PER_RUN = 50

# Max concurrent AI generations
MAX_CONCURRENT_GENERATIONS = 10

async def run_sync(func, *args, **kwargs):
    # Run a synchronous function in executor to avoid blocking the event loop.
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, 
        functools.partial(func, *args, **kwargs)
    )

def _get_eligible_leads() -> List[Dict[str, Any]]:
    """
    Fetch leads that are eligible for email sending.
    
    Criteria:
    - Campaign is active
    - Lead has not replied
    - Lead is not already processing/completed/failed
    - next_email_at is NULL (first email) or <= NOW()
    - current_sequence < max_follow_ups
    - Not locked (or lock is stale)
    """
    query = """
        SELECT 
            l.id as lead_id,
            l.email,
            l.first_name,
            l.last_name,
            l.company,
            l.title,
            l.notes,
            l.current_sequence,
            c.id as campaign_id,
            c.name as campaign_name,
            c.sender_name,
            c.sender_email,
            c.goal,
            c.follow_up_delay_minutes,
            c.max_follow_ups
        FROM leads l
        JOIN campaigns c ON l.campaign_id = c.id
        WHERE c.status = 'active'
          AND l.has_replied = false
          AND l.status NOT IN ('completed', 'replied', 'processing')
          AND l.current_sequence < c.max_follow_ups
          AND (l.next_email_at IS NULL OR l.next_email_at <= NOW())
          AND (l.locked_at IS NULL OR l.locked_at < NOW() - INTERVAL '%s minutes')
        ORDER BY l.next_email_at ASC NULLS FIRST
        LIMIT %s
    """

    with get_cursor() as cur:
        cur.execute(query, (LOCK_TIMEOUT_MINUTES, MAX_LEADS_PER_RUN))
        leads = cur.fetchall()
    
    return leads # type: ignore

def _lock_leads(lead_ids: List[str]) -> List[str]:
    """
    Attempt to lock multiple leads for processing.
    Returns list of successfully locked lead IDs.
    """
    if not lead_ids:
        return []
    
    query = """
        UPDATE leads 
        SET status = 'processing', locked_at = NOW(), updated_at = NOW()
        WHERE id = ANY(%s::uuid[])
          AND status NOT IN ('completed', 'replied', 'processing')
          AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '%s minutes')
        RETURNING id
    """

    with get_cursor(commit=True) as cur:
        cur.execute(query, (lead_ids, LOCK_TIMEOUT_MINUTES))
        results = cur.fetchall()
    
    return [str(r["id"]) for r in results]

def _get_previous_emails_batch(lead_ids: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    # Get previous emails for multiple leads at once.
    if not lead_ids:
        return {}

    query = """
        SELECT lead_id, sequence_number, subject, body, sent_at
        FROM emails
        WHERE lead_id = ANY(%s::uuid[]) AND status = 'sent'
        ORDER BY lead_id, sequence_number ASC
    """
    
    with get_cursor() as cur:
        cur.execute(query, (lead_ids,))
        emails = cur.fetchall()
    
    # Group by lead_id
    result: Dict[str, List[Dict[str, Any]]] = {lid: [] for lid in lead_ids}
    for email in emails:
        lid = str(email["lead_id"])
        if lid in result:
            result[lid].append(email)
    
    return result

def _record_emails_batch(email_records: List[Dict[str, Any]]) -> None:
    # Record multiple emails in the database using batch insert.
    if not email_records:
        return

    query = """
        INSERT INTO emails (lead_id, sequence_number, subject, body, status, resend_id, sent_at)
        VALUES %s
    """
    
    values = [
        (r["lead_id"], r["sequence_number"], r["subject"], r["body"], r["status"], r.get("resend_id"), r.get("sent_at"))
        for r in email_records
    ]
    
    with get_cursor(commit=True) as cur:
        execute_values(cur, query, values)

def _update_leads_after_send(updates: List[Dict[str, Any]]) -> None:
    # Update multiple leads after successful email send using batch execution.
    if not updates:
        return
        
    query = """
        UPDATE leads 
        SET current_sequence = %s,
            next_email_at = NOW() + INTERVAL '1 minute' * %s,
            status = %s,
            locked_at = NULL,
            updated_at = NOW()
        WHERE id = %s
    """
    
    # Prepare params: (new_sequence, delay_minutes, new_status, lead_id)
    params = [
        (
            u["new_sequence"],
            u["follow_up_delay_minutes"],
            'completed' if u["new_sequence"] >= u["max_follow_ups"] else 'active',
            u["lead_id"]
        )
        for u in updates
    ]
    
    with get_cursor(commit=True) as cur:
        execute_batch(cur, query, params)

def _handle_generation_failures(
    failed_leads: List[Dict[str, Any]], 
    error: str
) -> None:
    """
    Handle leads that failed email generation.
    - Increment current_sequence (counts as an attempt)
    - Record the failed email in emails table for activity tracking
    - Mark as 'failed' only if max_follow_ups exhausted, otherwise set back to 'pending' for retry
    """
    if not failed_leads:
        return
    
    email_records = []
    lead_updates_terminal = []  # leads that exhausted max_follow_ups
    lead_updates_retry = []     # leads that should retry
    
    for lead in failed_leads:
        lead_id = str(lead["lead_id"])
        new_sequence = lead["current_sequence"] + 1
        max_follow_ups = lead["max_follow_ups"]
        delay_minutes = lead["follow_up_delay_minutes"]
        
        # Record the failed attempt in emails table
        email_records.append({
            "lead_id": lead_id,
            "sequence_number": new_sequence,
            "subject": f"[FAILED] Generation error",
            "body": f"Error: {error}",
            "status": "failed",
            "resend_id": None,
            "sent_at": None
        })
        
        if new_sequence >= max_follow_ups:
            # Terminal failure - exhausted all attempts
            lead_updates_terminal.append(lead_id)
        else:
            # Can retry - schedule for next attempt
            lead_updates_retry.append((new_sequence, delay_minutes, lead_id))
    
    with get_cursor(commit=True) as cur:
        # Record failed emails
        if email_records:
            query = """
                INSERT INTO emails (lead_id, sequence_number, subject, body, status, resend_id, sent_at)
                VALUES %s
            """
            values = [
                (r["lead_id"], r["sequence_number"], r["subject"], r["body"], r["status"], r["resend_id"], r["sent_at"])
                for r in email_records
            ]
            execute_values(cur, query, values)
        
        # Mark terminal failures
        if lead_updates_terminal:
            cur.execute("""
                UPDATE leads 
                SET status = 'failed', current_sequence = current_sequence + 1, 
                    locked_at = NULL, updated_at = NOW()
                WHERE id = ANY(%s::uuid[])
            """, (lead_updates_terminal,))
            logger.error(f"Leads {lead_updates_terminal} terminally failed (max attempts exhausted): {error}")
        
        # Set retry leads back to pending with next_email_at
        if lead_updates_retry:
            query = """
                UPDATE leads 
                SET status = 'pending', 
                    current_sequence = %s,
                    next_email_at = NOW() + INTERVAL '1 minute' * %s,
                    locked_at = NULL, 
                    updated_at = NOW()
                WHERE id = %s
            """
            execute_batch(cur, query, lead_updates_retry)
            logger.warning(f"Leads scheduled for retry after generation failure: {[u[2] for u in lead_updates_retry]}")

def _check_campaign_completion(campaign_ids: List[str]) -> None:
    """
    Check if any campaigns should be marked as completed.
    A campaign is complete when ALL its leads are in terminal states (completed, replied, or failed).
    """
    if not campaign_ids:
        return
    
    # Deduplicate
    unique_campaign_ids = list(set(campaign_ids))
    
    query = """
        UPDATE campaigns c
        SET status = 'completed', updated_at = NOW()
        WHERE c.id = ANY(%s::uuid[])
          AND c.status = 'active'
          AND NOT EXISTS (
              SELECT 1 FROM leads l 
              WHERE l.campaign_id = c.id 
                AND l.status NOT IN ('completed', 'replied', 'failed')
          )
    """
    
    with get_cursor(commit=True) as cur:
        cur.execute(query, (unique_campaign_ids,))

async def generate_email_for_lead(
    lead: Dict[str, Any], 
    previous_emails: List[Dict[str, Any]]
) -> Tuple[Dict[str, Any], Dict[str, Any] | None, Exception | None]:
    """
    Generate personalized email for a single lead.
    Returns (lead, generated_email_data, error)
    """
    lead_id = str(lead["lead_id"])
    
    try:
        user_info = {
            "email": lead["email"],
            "first_name": lead["first_name"],
            "last_name": lead["last_name"],
            "company": lead["company"],
            "title": lead["title"],
            "notes": lead["notes"]
        }
        
        campaign_info = {
            "name": lead["campaign_name"],
            "goal": lead["goal"],
            "sender_name": lead["sender_name"],
            "sender_email": lead["sender_email"],
            "current_sequence": lead["current_sequence"] + 1,
            "max_follow_ups": lead["max_follow_ups"]
        }
        
        # Limit context window to last 5 emails
        # To prevent context limit issues on some LLMs
        recent_emails = previous_emails[-5:] if len(previous_emails) > 5 else previous_emails
        personalized = await generate_mail(user_info, campaign_info, recent_emails)
        
        email_data = {
            "lead_id": lead_id,
            "lead": lead,
            "subject": personalized.subject,
            "body": personalized.body,
            "sequence_number": lead["current_sequence"] + 1
        }
        
        return (lead, email_data, None)
        
    except Exception as e:
        logger.error(f"Failed to generate email for lead {lead_id}: {str(e)}")
        return (lead, None, e)

async def process_leads_job() -> None:
    """
    Main job: fetch eligible leads and process them.
    
    Flow:
    1. Fetch eligible leads (sync, in executor)
    2. Lock all leads at once (sync, in executor)
    3. Fetch previous emails for all leads (sync, in executor)
    4. Generate emails concurrently (async, truly parallel)
    5. Batch send all emails (sync, in executor)
    6. Record results and update leads (sync, in executor)
    """

    try:
        # Step 1: Fetch eligible leads
        leads = await run_sync(_get_eligible_leads)
        
        if not leads:
            return
        
        # Step 2: Lock all leads at once
        lead_ids = [str(lead["lead_id"]) for lead in leads]
        locked_ids = await run_sync(_lock_leads, lead_ids)
        
        if not locked_ids:
            logger.warning("[CRON] Failed to lock leads (already processing)")
            return
        
        # Filter to only locked leads
        locked_leads = [l for l in leads if str(l["lead_id"]) in locked_ids]
        
        # Step 3: Fetch previous emails for all locked leads
        previous_emails_map = await run_sync(_get_previous_emails_batch, locked_ids)
        
        # Step 4: Generate emails concurrently (truly async)
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_GENERATIONS)
        
        async def generate_with_semaphore(lead):
            async with semaphore:
                prev_emails = previous_emails_map.get(str(lead["lead_id"]), [])
                return await generate_email_for_lead(lead, prev_emails)
        
        generation_results = await asyncio.gather(
            *[generate_with_semaphore(lead) for lead in locked_leads],
            return_exceptions=True
        )
        
        # Separate successful generations from failures
        successful_generations: List[Dict[str, Any]] = []
        failed_leads: List[Dict[str, Any]] = []
        
        for result in generation_results:
            if isinstance(result, Exception):
                continue  # Already logged in generate_email_for_lead
            
            lead, email_data, error = result # type: ignore
            
            if error or email_data is None:
                failed_leads.append(lead)
            else:
                successful_generations.append(email_data)
        
        # Handle generation failures (with retry logic)
        if failed_leads:
            logger.warning(f"[CRON] {len(failed_leads)} leads failed generation")
            await run_sync(_handle_generation_failures, failed_leads, "Email generation failed")
        
        if not successful_generations:
            return
        
        # Step 5: Batch send all emails
        mails_to_send: List[Mail] = []
        for gen in successful_generations:
            lead = gen["lead"]
            mail = Mail(
                sender=Sender(name=lead["sender_name"], email=lead["sender_email"]),
                to=lead["email"],
                subject=gen["subject"],
                body=gen["body"]
            )
            mails_to_send.append(mail)
        
        # Create a deterministic idempotency key based on the leads in this batch.
        # If the server crashes after sending but before DB update, these exact same
        # leads will be picked up again, generating the SAME key. Resend will then
        # reject the duplicate send (crash recovery protection).
        batch_signature = sorted([
            f"{gen['lead_id']}-{gen['sequence_number']}" 
            for gen in successful_generations
        ])
        batch_string = "|".join(batch_signature)
        batch_hash = hashlib.sha256(batch_string.encode()).hexdigest()
        batch_idempotency_key = f"batch-run/{batch_hash}"
        
        try:
            # Batch send (sync, in executor) with idempotency key
            batch_response = await run_sync(send_mail_batch, mails_to_send, batch_idempotency_key)
            
            # Process batch response - Resend returns {"data": [{"id": "..."}, ...]}
            resend_ids = []
            if batch_response and "data" in batch_response:
                resend_ids = [item.get("id") for item in batch_response["data"]]
            
            # Step 6: Record emails and update leads
            email_records = []
            lead_updates = []
            now = datetime.now(timezone.utc)
            
            for i, gen in enumerate(successful_generations):
                resend_id = resend_ids[i] if i < len(resend_ids) else None
                
                email_records.append({
                    "lead_id": gen["lead_id"],
                    "sequence_number": gen["sequence_number"],
                    "subject": gen["subject"],
                    "body": gen["body"],
                    "status": "sent",
                    "resend_id": resend_id,
                    "sent_at": now
                })
                
                lead_updates.append({
                    "lead_id": gen["lead_id"],
                    "new_sequence": gen["sequence_number"],
                    "max_follow_ups": gen["lead"]["max_follow_ups"],
                    "follow_up_delay_minutes": gen["lead"]["follow_up_delay_minutes"]
                })
            
            await run_sync(_record_emails_batch, email_records)
            await run_sync(_update_leads_after_send, lead_updates)
            
            # Step 7: Check if any campaigns are now complete
            campaign_ids = list(set(gen["lead"]["campaign_id"] for gen in successful_generations))
            await run_sync(_check_campaign_completion, campaign_ids)
            
        except Exception as e:
            # Batch send failed - handle with retry logic
            logger.error(f"[CRON] Batch send failed: {str(e)}")
            failed_leads_from_send = [gen["lead"] for gen in successful_generations]
            await run_sync(_handle_generation_failures, failed_leads_from_send, f"Batch send failed: {str(e)}")

    except Exception as e:
        logger.error(f"[CRON] Email processing job failed with exception: {str(e)}")

def start_scheduler() -> None:
    # Start the background scheduler.
    global scheduler
    
    if scheduler is not None:
        logger.warning("Scheduler already running. Won't start a new one.")
        return
    
    scheduler = AsyncIOScheduler()
    
    # Add the job to run every minute, starting immediately
    scheduler.add_job(
        process_leads_job,
        trigger=IntervalTrigger(seconds=JOB_INTERVAL_SECONDS),
        id="email_processing_job",
        name="Process pending emails",
        replace_existing=True,
        next_run_time=datetime.now()  # Run immediately on startup
    )
    
    scheduler.start()
    logger.info(f"Scheduler started - running every {JOB_INTERVAL_SECONDS} seconds (first run immediate)")

def stop_scheduler() -> None:
    # Stop the background scheduler.
    global scheduler
    
    if scheduler is None:
        logger.warning("Scheduler not running. Shutdown not needed.")
        return
    
    scheduler.shutdown(wait=False)
    scheduler = None
    logger.info("Scheduler stopped")