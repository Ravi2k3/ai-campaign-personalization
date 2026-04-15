from .campaigns import router as campaigns_router
from .leads import router as leads_router, detail_router as leads_detail_router
from .documents import router as documents_router

__all__ = [
    "campaigns_router",
    "leads_router",
    "leads_detail_router",
    "documents_router",
]
