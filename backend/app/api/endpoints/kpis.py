"""KPI Dashboard endpoints for aggregated metrics."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser
from app.db.session import get_db
from app.schemas.kpi import KPIResponse
from app.services.kpi_service import KPIService
from app.core.errors import raise_http_error

router = APIRouter()


@router.get(
    "/",
    summary="Get KPI dashboard metrics (all users)",
    response_model=KPIResponse,
    response_description="Aggregated KPI metrics for all users",
    status_code=status.HTTP_200_OK,
)
async def get_kpis(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get aggregated KPI metrics for the dashboard (all users).

    This endpoint returns all metrics needed for the KPI dashboard including:
    - Summary metrics (total reports, average rating)
    - Syntax, complexity, semantic, and custom rules metrics
    - Chart data (violation distribution, rating distribution, trends)
    - Recent reports list

    Args:
        current_user: Authenticated user from JWT token
        db: Database session

    Returns:
        KPIResponse: Complete dashboard metrics

    Raises:
        HTTPException: If calculation fails (500)
    """
    try:
        return await KPIService.get_kpis(db)
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to calculate KPI metrics", error=e
        )


@router.get(
    "/me",
    summary="Get KPI dashboard metrics for current user",
    response_model=KPIResponse,
    response_description="Aggregated KPI metrics for the current user's models",
    status_code=status.HTTP_200_OK,
)
async def get_my_kpis(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get aggregated KPI metrics for models uploaded by the current user.

    This endpoint returns metrics filtered to only include evaluation reports
    from BPMN models uploaded by the authenticated user. It also includes
    personalized LLM-generated learning suggestions.

    Args:
        current_user: Authenticated user from JWT token
        db: Database session

    Returns:
        KPIResponse: User-specific dashboard metrics with learning suggestions

    Raises:
        HTTPException: If calculation fails (500)
    """
    try:
        user_id = UUID(current_user.sub)
        return await KPIService.get_kpis(db, user_id=user_id)
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to calculate KPI metrics", error=e
        )
