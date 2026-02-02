# Everis - AI Mail Personalization

> Mini-SaaS for automated, AI-powered email outreach with intelligent follow-up sequences

## Features

- **Campaign Management** – Create, start/pause, and delete email outreach campaigns
- **AI Personalization** – Generate human-like personalized emails using LLMs (Groq/OpenAI-compatible)
- **Lead Management** – Import leads via CSV or add manually, view/delete individual leads
- **Automated Follow-ups** – Configurable follow-up sequences with customizable delays
- **Smart Scheduling** – Background cron job processes emails every minute
- **Reply Tracking** – Mark leads as replied to stop further outreach
- **Email Activity Timeline** – View complete email history for each lead
- **Crash Recovery** – Idempotency keys prevent duplicate emails on server restart

## Tech Stack

| Layer     | Technology                | Purpose                                  |
| --------- | ------------------------- | ---------------------------------------- |
| Frontend  | React + Vite + TypeScript | Modern SPA with shadcn/ui components     |
| Styling   | Tailwind CSS              | Utility-first CSS                        |
| Backend   | Python (FastAPI)          | Async REST API                           |
| Database  | PostgreSQL (Supabase)     | Data persistence                         |
| Email     | Resend                    | Transactional email delivery with batch  |
| LLM       | Groq / OpenAI-compatible  | AI-powered email personalization         |
| Scheduler | APScheduler               | Background job processing                |
| Logging   | Axiom                     | Centralized logging                      |

## Quick Start

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run server (scheduler starts automatically)
uvicorn app:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
├── backend/
│   ├── app.py                  # FastAPI entry point + lifespan (scheduler)
│   └── src/
│       ├── api/                # REST endpoints
│       │   ├── campaigns.py    # Campaign CRUD + start/stop
│       │   ├── leads.py        # Leads CRUD + CSV import
│       │   └── models.py       # Pydantic schemas
│       ├── db/                 # Database layer
│       │   ├── base.py         # Schema definitions
│       │   ├── engine.py       # Connection pooling
│       │   └── operations.py   # Table initialization
│       ├── mail/               # Email system
│       │   ├── agent.py        # AI email generation (LLM)
│       │   ├── client.py       # Resend integration
│       │   └── base.py         # Mail models
│       ├── scheduler/          # Background jobs
│       │   └── job.py          # Email processing cron
│       └── logger.py           # Axiom logging
├── frontend/
│   └── src/
│       ├── components/         # React components
│       │   ├── ui/             # shadcn/ui primitives
│       │   ├── AddLeadModal.tsx
│       │   ├── CreateCampaignModal.tsx
│       │   ├── DeleteCampaignModal.tsx
│       │   ├── DeleteLeadModal.tsx
│       │   └── ImportCSVModal.tsx
│       ├── pages/              # Route pages
│       │   ├── Campaigns.tsx   # Campaign list
│       │   ├── CampaignDetail.tsx  # Leads table
│       │   └── LeadDetail.tsx  # Email activity timeline
│       └── lib/
│           ├── api.ts          # API client
│           └── utils.ts        # Utilities
└── README.md
```

## Environment Variables

Create a `.env` file in the `backend/` folder:

```env
# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_DOMAIN=yourdomain.com  # Must be verified in Resend

# LLM (Groq or OpenAI-compatible)
LLM_SOURCE=groq
LLM_API_KEY=gsk_...
LLM_MODEL=llama-3.3-70b-versatile

# Database (PostgreSQL)
DATABASE_URI=postgresql://user:pass@host:5432/dbname

# Logging (Axiom - optional)
AXIOM_TOKEN=xaat-...
AXIOM_DATASET=everis-logs
```

## How It Works

### Email Processing Flow

1. **Campaign Created** – User creates a campaign with sender info, goal, follow-up delay, and max follow-ups
2. **Leads Imported** – Leads added via CSV or manually, status set to `pending`
3. **Campaign Started** – Status changes to `active`, pending leads queued for immediate processing
4. **Cron Job Runs** (every 60 seconds):
   - Fetches eligible leads (active campaign, not replied, due for email)
   - Locks leads to prevent race conditions
   - Generates personalized emails via LLM (10 concurrent)
   - Batch sends via Resend with idempotency key
   - Records emails and schedules next follow-up
5. **Lead Replies** – User marks lead as replied, stopping further emails
6. **Campaign Completes** – Auto-completes when all leads reach terminal state

### Lead Status Flow

```
pending → processing → active → completed
                    ↘ replied
                    ↘ failed
```

## API Endpoints

| Method | Endpoint                          | Description              |
| ------ | --------------------------------- | ------------------------ |
| GET    | `/campaigns`                      | List all campaigns       |
| POST   | `/campaigns`                      | Create campaign          |
| GET    | `/campaigns/{id}`                 | Get campaign details     |
| DELETE | `/campaigns/{id}`                 | Delete campaign          |
| PATCH  | `/campaigns/{id}/status`          | Start/stop campaign      |
| GET    | `/campaigns/{id}/leads`           | List campaign leads      |
| POST   | `/campaigns/{id}/leads`           | Add single lead          |
| POST   | `/campaigns/{id}/leads/import`    | Import leads from CSV    |
| GET    | `/leads/{id}`                     | Get lead details         |
| DELETE | `/leads/{id}`                     | Delete lead              |
| PATCH  | `/leads/{id}/replied`             | Mark lead as replied     |
| GET    | `/leads/{id}/emails`              | Get lead email activity  |
| GET    | `/health`                         | Health check             |

## Architecture

![Architecture](assets/arch.png)
