"""Health check endpoint for monitoring service availability."""

import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.schemas.common import HealthCheck
from app.db.session import AsyncSessionLocal
from app.core.config import get_settings
from app.services.bpmn_validation_services import BPMNValidationService, BPMNValidationError

# Timeout for database health check (seconds)
DB_HEALTH_CHECK_TIMEOUT = 5.0

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

# Initialize BPMN validation service for health check
try:
    _bpmn_validation_service = BPMNValidationService()
except BPMNValidationError:
    _bpmn_validation_service = None


@router.get(
    "",
    summary="Health Check",
    response_model=HealthCheck,
    responses={
        200: {"description": "Service is healthy and operational."},
        503: {"description": "Service is degraded or unavailable."},
    },
)
async def health_check():
    """
    Performs a comprehensive health check on the FastAPI backend.

    Checks database connectivity, LLM API configuration, and BPMN validation service.
    Database check has a timeout to ensure the endpoint remains responsive even when
    the connection pool is exhausted.

    Returns:
        HealthCheck: Returns a JSON response with detailed health status
    """
    checks = HealthCheck()
    logger.debug("Health check requested")

    # Check database connection with timeout to ensure health endpoint stays responsive
    # Uses AsyncSessionLocal directly (not get_db) to avoid retry delays in health checks
    # Health checks should fail fast to give accurate status, retries happen at request level
    try:
        async with asyncio.timeout(DB_HEALTH_CHECK_TIMEOUT):
            async with AsyncSessionLocal() as db:
                await db.execute(text("SELECT 1"))
        checks.database = "ok"
    except asyncio.TimeoutError:
        logger.warning("Health check: Database connection timed out")
        checks.database = "error"
        checks.status = "degraded"
    except asyncio.CancelledError:
        # Can occur during database maintenance/restarts
        logger.warning("Health check: Database connection cancelled (likely maintenance)")
        checks.database = "error"
        checks.status = "degraded"
    except Exception as e:
        logger.warning(f"Health check: Database connection failed: {e}")
        checks.database = "error"
        checks.status = "degraded"

    # Check LLM API configuration
    if not settings.OPENAI_API_KEY and not settings.GEMINI_API_KEY:
        checks.llm_api = "not_configured"
        checks.status = "degraded"
    else:
        checks.llm_api = "ok"

    # Check BPMN validation service
    if _bpmn_validation_service is None:
        checks.bpmn_validation = "error"
        checks.status = "degraded"
    else:
        checks.bpmn_validation = "ok"

    # Set overall status to ok if no checks failed
    if checks.status == "unknown":
        checks.status = "ok"

    status_code = 200 if checks.status == "ok" else 503
    return JSONResponse(content=checks.model_dump(), status_code=status_code)
