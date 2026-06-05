"""Central router that bundles all API endpoints."""

from fastapi import APIRouter
from .health import router as health_router
from .evaluation import router as evaluation_router
from .models import router as models_router
from .issue_exclusions import router as issue_exclusions_router
from .kpis import router as kpis_router
from .analyses import router as analyses_router
from .chat import router as chat_router

# Create main API router
api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(evaluation_router, prefix="/evaluation", tags=["evaluation"])
api_router.include_router(models_router, prefix="/models", tags=["models"])
api_router.include_router(issue_exclusions_router, prefix="/evaluation", tags=["evaluation"])
api_router.include_router(kpis_router, prefix="/kpis", tags=["kpis"])
api_router.include_router(analyses_router, prefix="/analyses", tags=["analyses"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
