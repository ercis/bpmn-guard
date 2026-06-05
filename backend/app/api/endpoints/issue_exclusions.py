"""API endpoints for issue exclusion operations."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser
from app.db.session import get_db
from app.schemas.issue_exclusion import (
    BulkExclusionRequest,
    BulkExclusionResponse,
    IssueExclusionCreate,
    IssueExclusionDeleteResponse,
    IssueExclusionListResponse,
    IssueExclusionResponse,
)
from app.services.issue_exclusion_service import IssueExclusionService
from app.core.errors import raise_http_error

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/reports/{report_id}/exclusions",
    summary="List all exclusions for a report",
    response_model=IssueExclusionListResponse,
    response_description="List of all exclusions for the specified report",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Not authenticated"},
    },
)
async def list_exclusions(
    report_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get all issue exclusions for a specific evaluation report.

    Requires authentication.

    Args:
        report_id: UUID of the evaluation report
        current_user: Authenticated user from JWT
        db: Database session

    Returns:
        IssueExclusionListResponse: Object containing total count and list of exclusions
    """
    try:
        exclusions = await IssueExclusionService.get_exclusions_for_report(db, report_id)

        return IssueExclusionListResponse(
            total=len(exclusions),
            items=[IssueExclusionResponse.model_validate(e) for e in exclusions],
        )

    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to retrieve exclusions", error=e
        )


@router.post(
    "/reports/{report_id}/exclusions",
    summary="Create a new issue exclusion",
    response_model=IssueExclusionResponse,
    response_description="The created exclusion",
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"description": "Duplicate exclusion or invalid data"},
        401: {"description": "Not authenticated"},
        404: {"description": "Report not found"},
    },
)
async def create_exclusion(
    report_id: UUID,
    data: IssueExclusionCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Create a new issue exclusion for an evaluation report.

    Marks an issue as excluded/irrelevant. Requires authentication.

    Args:
        report_id: UUID of the evaluation report
        data: Exclusion creation data
        current_user: Authenticated user from JWT
        db: Database session

    Returns:
        IssueExclusionResponse: The created exclusion
    """
    try:
        exclusion = await IssueExclusionService.create_exclusion(db, report_id, data, current_user.sub)
        return exclusion

    except HTTPException:
        raise
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to create exclusion", error=e
        )


@router.put(
    "/reports/{report_id}/exclusions",
    summary="Bulk update exclusions for a report",
    response_model=BulkExclusionResponse,
    response_description="Bulk operation result with current exclusions",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Not authenticated"},
        404: {"description": "Report not found"},
    },
)
async def bulk_update_exclusions(
    report_id: UUID,
    data: BulkExclusionRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Bulk update exclusions for a report (save all changes from review page).

    Creates new exclusions and deletes removed ones in a single operation.
    Requires authentication.

    Args:
        report_id: UUID of the evaluation report
        data: Bulk update request with to_create and to_delete lists
        current_user: Authenticated user from JWT
        db: Database session

    Returns:
        BulkExclusionResponse: Operation result with current exclusions
    """
    try:
        created_count, deleted_count, skipped_count, exclusions = await IssueExclusionService.bulk_update_exclusions(
            db, report_id, data, current_user.sub
        )

        return BulkExclusionResponse(
            success=True,
            created_count=created_count,
            deleted_count=deleted_count,
            skipped_count=skipped_count,
            exclusions=[IssueExclusionResponse.model_validate(e) for e in exclusions],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to update exclusions", error=e
        )


@router.delete(
    "/exclusions/{exclusion_id}",
    summary="Delete an exclusion (restore the issue)",
    response_model=IssueExclusionDeleteResponse,
    response_description="Deletion confirmation",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Not authenticated"},
        404: {"description": "Exclusion not found"},
    },
)
async def delete_exclusion(
    exclusion_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Delete an issue exclusion (restore the issue to the report).

    Requires authentication.

    Args:
        exclusion_id: UUID of the exclusion to delete
        current_user: Authenticated user from JWT
        db: Database session

    Returns:
        IssueExclusionDeleteResponse: Deletion confirmation
    """
    try:
        deleted = await IssueExclusionService.delete_exclusion(db, exclusion_id)

        if not deleted:
            raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="Exclusion not found")

        return IssueExclusionDeleteResponse(
            success=True,
            message="Exclusion deleted successfully",
            id=exclusion_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to delete exclusion", error=e
        )
