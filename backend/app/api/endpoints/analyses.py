"""Analysis status tracking endpoints."""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid_extensions import uuid7

from app.db.session import get_db, AsyncSessionLocal
from app.schemas.analysis_status import (
    AnalysisStatusResponse,
    RunningAnalysesResponse,
    StartAnalysisRequest,
    StartAnalysisResponse,
)
from app.core.logging import with_logging_context
from app.services.analysis_status_service import AnalysisStatusService
from app.services.bpmn_model_service import BPMNModelService
from app.services.evaluation_pipeline_service import EvaluationPipelineService
from app.core.errors import raise_http_error
from app.api.dependencies import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter()

# Node names that we track for progress updates
TRACKED_NODES = {
    "duplicate_check",
    "semantic_label_check",
    "complexity_check",
    "custom_checks",
    "validation_check",
    "overall_evaluation",
}


async def _on_step_complete(analysis_id: UUID, step_name: str) -> None:
    """Callback when a step completes."""
    async with AsyncSessionLocal() as db:
        service = AnalysisStatusService(db)
        await service.complete_step(analysis_id, step_name)


async def _on_complete(analysis_id: UUID, report_id: UUID) -> None:
    """Callback to mark analysis as completed."""
    async with AsyncSessionLocal() as db:
        service = AnalysisStatusService(db)
        await service.complete_analysis(analysis_id, report_id)


async def _on_fail(analysis_id: UUID, error: str) -> None:
    """Callback to mark analysis as failed."""
    async with AsyncSessionLocal() as db:
        service = AnalysisStatusService(db)
        await service.fail_analysis(analysis_id, error)


async def run_evaluation_background(analysis_id: UUID, model_id: UUID, graph, user_id: UUID | None = None) -> None:
    """
    Background task to run evaluation with status updates.

    Args:
        analysis_id: UUID of the analysis to track
        model_id: UUID of the BPMN model to evaluate
        graph: Pre-compiled LangGraph workflow
        user_id: UUID of the user who initiated the evaluation
    """
    # Get model (short-lived session)
    async with AsyncSessionLocal() as db:
        bpmn_model = await BPMNModelService.get_model_by_id(db, model_id)
        if not bpmn_model:
            logger.error(f"Model {model_id} not found for analysis {analysis_id}")
            await _on_fail(analysis_id, f"Model {model_id} not found")
            return
        # Detach from session so it can be used after session closes
        db.expunge(bpmn_model)

    try:
        pipeline_service = EvaluationPipelineService()
        await pipeline_service.evaluate_with_status_updates(
            graph=graph,
            bpmn_model=bpmn_model,
            analysis_id=analysis_id,
            tracked_nodes=TRACKED_NODES,
            on_step_complete=_on_step_complete,
            on_complete=_on_complete,
            on_fail=_on_fail,
            uploaded_by=user_id,
        )
    except Exception as e:
        # Log unexpected exceptions; evaluate_with_status_updates is responsible for
        # invoking the failure callback when appropriate.
        logger.exception(f"Background evaluation failed for analysis {analysis_id}: {e}")


@router.get(
    "/running",
    response_model=RunningAnalysesResponse,
    summary="Get all running analyses",
    response_description="List of all currently running analyses",
    status_code=status.HTTP_200_OK,
)
async def get_running_analyses(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get list of all currently running analyses.

    Returns:
        RunningAnalysesResponse: List of running analyses with total count
    """
    service = AnalysisStatusService(db)
    analyses = await service.get_running_analyses()
    return RunningAnalysesResponse(
        analyses=[AnalysisStatusResponse.model_validate(a) for a in analyses],
        total=len(analyses),
    )


@router.get(
    "/{analysis_id}/status",
    response_model=AnalysisStatusResponse,
    summary="Get analysis status",
    response_description="Current status of a specific analysis",
    status_code=status.HTTP_200_OK,
)
async def get_analysis_status(
    analysis_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get current status of a specific analysis.

    Args:
        analysis_id: UUID of the analysis

    Returns:
        AnalysisStatusResponse: Current analysis status

    Raises:
        HTTPException: If analysis not found (404)
    """
    service = AnalysisStatusService(db)
    analysis = await service.get_analysis_status(analysis_id)
    if not analysis:
        raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="Analysis not found")
    return AnalysisStatusResponse.model_validate(analysis)


@router.post(
    "/new",
    response_model=StartAnalysisResponse,
    summary="Start a new analysis",
    response_description="Analysis started confirmation with analysis ID",
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_analysis(
    request_body: StartAnalysisRequest,
    current_user: CurrentUser,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    background_tasks: BackgroundTasks,
):
    """
    Start a new evaluation analysis (runs in background).

    This endpoint:
    1. Validates the model exists
    2. Creates an analysis record in the database
    3. Starts the evaluation workflow in a background task
    4. Returns immediately with the analysis ID

    Args:
        request_body: Request containing the model_id
        request: FastAPI request object (for accessing app state)
        db: Database session
        background_tasks: FastAPI background tasks

    Returns:
        StartAnalysisResponse: Analysis ID and status

    Raises:
        HTTPException: If model not found (404) or workflow not initialized (500)
    """
    # Validate model exists
    model = await BPMNModelService.get_model_by_id(db, request_body.model_id)
    if not model:
        raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="Model not found")

    # Get the evaluation workflow graph from app state
    graph = getattr(request.app.state, "evaluation_workflow_graph", None)
    if graph is None:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Evaluation workflow not initialized"
        )

    # Generate analysis ID
    analysis_id = UUID(str(uuid7()))

    # Register the analysis in database
    status_service = AnalysisStatusService(db)
    await status_service.start_analysis(analysis_id, request_body.model_id, model.name)

    # Start background task with logging context preserved
    background_tasks.add_task(
        with_logging_context(run_evaluation_background),
        analysis_id=analysis_id,
        model_id=request_body.model_id,
        graph=graph,
        user_id=UUID(current_user.sub),
    )

    logger.info(f"Started analysis {analysis_id} for model {request_body.model_id}")
    return StartAnalysisResponse(analysis_id=analysis_id, status="started")
