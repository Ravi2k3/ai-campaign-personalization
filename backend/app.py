from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.db import init_db, test_connection # type: ignore
from src.api import campaigns_router        # type: ignore

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize database tables
    if test_connection():
        init_db()
    yield
    # Shutdown: cleanup if needed

app = FastAPI(
    title="Everis AI Mail Personalization",
    description="Mini-SaaS for automated personalized email outreach",
    version="1.0.0",
    lifespan=lifespan
)

# CORS - allow frontend to connect
BASE_URL = "http://localhost"
BACKEND_URL = f"{BASE_URL}:8000"
FRONTEND_URL = f"{BASE_URL}:5173"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[BASE_URL, BACKEND_URL, FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(campaigns_router)

@app.get("/health")
async def health_check():
    # Health check endpoint
    db_connected = test_connection()
    return {
        "status": "healthy" if db_connected else "degraded",
        "database": "connected" if db_connected else "disconnected"
    }

@app.get("/")
async def root():
    return {"message": "Everis AI Mail Personalization API"}