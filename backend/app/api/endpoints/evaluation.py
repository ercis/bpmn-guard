"""BPMN evaluation endpoints for reports and custom checks."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import BPMNModelDependency, CurrentUser
from app.db.session import get_db
from app.schemas.custom_checks import CustomChecksResult
from app.schemas.evaluation import (
    EvaluationReport,
    EvaluationReportDeleteResponse,
    EvaluationReportListResponse,
)
from app.services.custom_checks_service import CustomCheckError, CustomChecksService
from app.services.evaluation_pipeline_service import EvaluationPipelineService
from app.core.errors import raise_http_error

logger = logging.getLogger(__name__)

# All endpoints in this file will be grouped under the "evaluation" tag
router = APIRouter()


@router.get(
    "/reports",
    summary="List all evaluation reports",
    response_model=EvaluationReportListResponse,
    response_description="List of all evaluation reports with total count",
    status_code=status.HTTP_200_OK,
)
async def list_reports(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 15,
    uploaded_by: Annotated[UUID | None, Query()] = None,
    sort_by: Annotated[str, Query()] = "created_at",
    sort_direction: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
):
    """
    Get a paginated list of evaluation reports.

    Args:
        current_user: Authenticated user from JWT token dependency
        db: Database session
        page: Page number (1-based)
        page_size: Number of items per page (1-100)
        uploaded_by: Optional filter by user UUID
        sort_by: Field to sort by (file_path, evaluation_rating, created_at, updated_at)
        sort_direction: Sort direction (asc or desc)

    Returns:
        EvaluationReportListResponse: Object containing total count and list of reports
    """
    try:
        reports, total = await EvaluationPipelineService.get_all_reports(
            db,
            page=page,
            page_size=page_size,
            uploaded_by=uploaded_by,
            sort_by=sort_by,
            sort_direction=sort_direction,
        )

        return EvaluationReportListResponse(total=total, items=reports)
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to retrieve evaluation reports", error=e
        )


@router.get(
    "/reports/{report_id}",
    summary="Get a single evaluation report by ID",
    response_model=EvaluationReport,
    response_description="Evaluation report details",
    status_code=status.HTTP_200_OK,
)
async def get_report(
    report_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get a single evaluation report by its ID.

    This endpoint retrieves detailed information about a specific evaluation report.

    Args:
        report_id: UUID of the report to retrieve
        db: Database session

    Returns:
        EvaluationReport: Complete evaluation report with all check results

    Raises:
        HTTPException: If report not found (404) or database operation fails (500)
    """
    try:
        report = await EvaluationPipelineService.get_report_by_id(db, report_id)

        if not report:
            raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="Evaluation report not found")

        return report

    except HTTPException:
        raise
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to retrieve evaluation report", error=e
        )


@router.delete(
    "/reports/{report_id}",
    summary="Delete an evaluation report by ID",
    response_model=EvaluationReportDeleteResponse,
    response_description="Deletion confirmation with report details",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Not authenticated or invalid token"},
        404: {"description": "Report not found"},
        500: {"description": "Internal server error"},
    },
)
async def delete_report(
    report_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Delete an evaluation report by its ID.

    This endpoint deletes a specific evaluation report from the database.
    Authentication is required.

    Args:
        report_id: UUID of the report to delete
        current_user: Authenticated user from JWT token dependency
        db: Database session

    Returns:
        EvaluationReportDeleteResponse: Success status, message, and deleted report ID

    Raises:
        HTTPException: If report not found (404) or database operation fails (500)
    """
    try:
        deleted = await EvaluationPipelineService.delete_report(db, report_id)

        if not deleted:
            raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="Evaluation report not found")
        return EvaluationReportDeleteResponse(success=True, message="Report deleted successfully", id=report_id)

    except HTTPException:
        raise
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to delete evaluation report", error=e
        )


@router.post(
    "/custom-checks-upload",
    summary="Run custom BPMN validation checks on uploaded file",
    response_description="Return custom check results",
    status_code=status.HTTP_200_OK,
)
async def check_custom_rules(current_user: CurrentUser, bpmn_model: BPMNModelDependency) -> CustomChecksResult:
    """
    Run custom validation checks on an uploaded BPMN file.

    This endpoint runs custom business rule checks on the BPMN model,
    separate from the standard syntax and best practices checks.

    Args:
        bpmn_model: BPMN model database object if provided with a valid ID.

    Returns:
        BPMNCustomChecksResult: Custom check results
    """

    # Run custom checks
    bpmn_content = bpmn_model.bpmn_xml
    if bpmn_content is None:
        raise_http_error(status_code=status.HTTP_400_BAD_REQUEST, message="BPMN model has no XML content")
    filename = bpmn_model.name or "default.bpmn"
    try:
        result = CustomChecksService().validate_content(bpmn_content, filename=filename)
        return result

    except CustomCheckError as e:
        raise_http_error(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Custom check failed", error=e)
    except Exception as e:
        raise_http_error(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Internal server error", error=e)
