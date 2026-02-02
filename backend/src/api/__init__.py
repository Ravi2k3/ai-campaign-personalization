from .campaigns import router as campaigns_router
from .leads import router as leads_router, detail_router as leads_detail_router
from .webhooks import router as webhooks_router

__all__ = [
    "campaigns_router",
    "leads_router",
    "leads_detail_router",
    "webhooks_router"
]