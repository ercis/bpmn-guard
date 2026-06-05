"""Chat endpoints for BPMN model discussions."""

import logging
from collections.abc import AsyncGenerator
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser
from app.core.errors import raise_http_error
from app.db.session import AsyncSessionLocal, get_db
from app.schemas.chat import (
    ChatDeleteResponse,
    ChatHistoryResponse,
    ChatMessageSchema,
    ChatRequest,
)
from app.services.bpmn_model_service import BPMNModelService
from app.services.chat_service import ChatService
from app.services.evaluation_pipeline_service import EvaluationPipelineService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/{report_id}/history",
    summary="Get chat history for a report",
    response_model=ChatHistoryResponse,
    response_description="List of all chat messages for the report",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Not authenticated"},
        404: {"description": "Report not found"},
    },
)
async def get_chat_history(
    report_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get all chat messages for an evaluation report.

    Requires authentication.

    Args:
        report_id: UUID of the evaluation report
        current_user: Authenticated user from JWT
        db: Database session

    Returns:
        ChatHistoryResponse: Object containing list of messages and total count
    """
    try:
        # Verify report exists
        report = await EvaluationPipelineService.get_report_by_id(db, report_id)
        if not report:
            raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="Evaluation report not found")

        messages = await ChatService.get_chat_history(db, report_id)
        return ChatHistoryResponse(
            messages=[ChatMessageSchema.model_validate(m) for m in messages],
            total=len(messages),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to fetch chat history", error=e
        )


@router.delete(
    "/{report_id}/history",
    summary="Delete chat history for a report",
    response_model=ChatDeleteResponse,
    response_description="Deletion confirmation with count",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Not authenticated"},
    },
)
async def delete_chat_history(
    report_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Delete all chat messages for an evaluation report.

    Requires authentication.

    Args:
        report_id: UUID of the evaluation report
        current_user: Authenticated user from JWT
        db: Database session

    Returns:
        ChatDeleteResponse: Deletion confirmation with count of deleted messages
    """
    try:
        deleted_count = await ChatService.delete_chat_history(db, report_id)
        return ChatDeleteResponse(success=True, deleted_count=deleted_count)

    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to delete chat history", error=e
        )


@router.post(
    "/stream",
    summary="Chat about a BPMN evaluation report (streaming)",
    response_description="Streaming text response from the AI assistant",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Not authenticated"},
        404: {"description": "Report or BPMN model not found"},
    },
)
async def chat_stream(
    request_body: ChatRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StreamingResponse:
    """
    Chat with the AI about a BPMN evaluation report with streaming response.

    - Saves user message to database
    - Streams AI response
    - Saves AI response to database when complete

    Requires authentication.

    Args:
        request_body: Chat request containing report_id and message
        current_user: Authenticated user from JWT
        db: Database session

    Returns:
        StreamingResponse: Streaming text/plain response with AI assistant's reply
    """
    try:
        # Fetch report
        report = await EvaluationPipelineService.get_report_by_id(db, request_body.report_id)
        if not report:
            raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="Evaluation report not found")

        # Fetch BPMN model
        bpmn_model = await BPMNModelService.get_model_by_id(db, report.model_id)
        if not bpmn_model:
            raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="BPMN model not found")

        # Get chat history before saving the new user message
        history_for_llm = await ChatService.get_chat_history(db, request_body.report_id)
        # Truncate to last 20 messages to avoid context window overflow
        MAX_HISTORY_FOR_LLM = 20
        if len(history_for_llm) > MAX_HISTORY_FOR_LLM:
            history_for_llm = history_for_llm[-MAX_HISTORY_FOR_LLM:]

        # Save user message after fetching history
        await ChatService.save_message(db, request_body.report_id, "user", request_body.message)

        service = ChatService.setup_chat_service()

        # Capture report_id for use in generator
        report_id = request_body.report_id

        async def generate() -> AsyncGenerator[str, None]:
            full_response = ""
            streaming_completed = False
            try:
                async for chunk in service.chat_stream(
                    bpmn_model=bpmn_model,
                    report=report,
                    history=history_for_llm,
                    message=request_body.message,
                ):
                    full_response += chunk
                    yield chunk

                # Mark streaming as successfully completed
                streaming_completed = True

            except Exception as e:
                logger.exception(f"Error during chat stream: {e}")
                yield "Error: An unexpected error occurred. Please try again."

            finally:
                # Only save if streaming completed successfully and response is non-empty
                if streaming_completed and full_response.strip():
                    try:
                        async with AsyncSessionLocal() as save_db:
                            await ChatService.save_message(save_db, report_id, "assistant", full_response)
                    except Exception as e:
                        logger.exception(f"Failed to save assistant response: {e}")

        return StreamingResponse(
            generate(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to process chat message", error=e
        )
