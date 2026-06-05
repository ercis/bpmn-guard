"""BPMN Models endpoints for listing and managing BPMN models."""

import logging
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.dependencies import CurrentUser
from app.db.session import get_db
from app.schemas.bpmn_model import (
    BPMNModelListResponse,
    BPMNModelResponse,
    BPMNModelCreate,
    BPMNModelUpdate,
    BPMNModelDeleteResponse,
)
from app.services.bpmn_model_service import BPMNModelService
from app.core.errors import raise_http_error

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "",
    summary="List all BPMN models",
    response_model=BPMNModelListResponse,
    response_description="List of all BPMN models with total count",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Not authenticated or invalid token"},
        500: {"description": "Internal server error"},
    },
)
async def list_models(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 15,
    uploaded_by: Annotated[UUID | None, Query()] = None,
    sort_by: Annotated[str, Query()] = "created_at",
    sort_direction: Annotated[str, Query(pattern="^(asc|desc)$")] = "desc",
):
    """
    Get a paginated list of BPMN models.

    Args:
        current_user: Authenticated user from JWT token dependency
        db: Database session
        page: Page number (1-based)
        page_size: Number of items per page (1-100)
        uploaded_by: Optional filter by user UUID
        sort_by: Field to sort by (name, version, file_size, created_at, updated_at)
        sort_direction: Sort direction (asc or desc)

    Returns:
        BPMNModelListResponse: Object containing total count and list of models
    """
    try:
        models, total = await BPMNModelService.get_all_models(
            db,
            page=page,
            page_size=page_size,
            uploaded_by=uploaded_by,
            sort_by=sort_by,
            sort_direction=sort_direction,
        )

        return BPMNModelListResponse(total=total, items=[BPMNModelResponse.model_validate(model) for model in models])
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to retrieve BPMN models", error=e
        )


@router.post(
    "",
    summary="Create a new BPMN model",
    response_model=BPMNModelResponse,
    response_description="Created BPMN model",
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"description": "Invalid request data"},
        401: {"description": "Not authenticated or invalid token"},
        500: {"description": "Internal server error"},
    },
)
async def create_model(
    file: Annotated[UploadFile, File(...)],
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Create a new BPMN model record by uploading a file.

    This endpoint uploads a BPMN file and creates a database record.
    The model name is extracted from the filename, version defaults to "1.0",
    and description is auto-generated. Authentication is required.

    Args:
        file: The uploaded BPMN file
        current_user: Authenticated user from JWT token dependency
        db: Database session

    Returns:
        BPMNModelResponse: Created model with all fields

    Raises:
        HTTPException: If validation fails (400) or database operation fails (500)
    """
    try:
        # Validate filename exists
        if not file.filename:
            raise_http_error(status_code=status.HTTP_400_BAD_REQUEST, message="File name is required")

        # Extract name from filename (remove extension)
        name = file.filename.rsplit(".", 1)[0]

        # Transform request to create schema with uploaded_by
        model_create = BPMNModelCreate(
            name=name,
            version="1.0",
            uploaded_by=UUID(current_user.sub),
        )

        # Create model in database
        model = await BPMNModelService.create_model(db=db, file=file, model_data=model_create)
        return BPMNModelResponse.model_validate(model)

    except ValueError as e:
        raise_http_error(status_code=status.HTTP_400_BAD_REQUEST, message="Invalid BPMN model data", error=e)
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to create BPMN model", error=e
        )


@router.get(
    "/{model_id}",
    summary="Get a single BPMN model by ID",
    response_model=BPMNModelResponse,
    response_description="BPMN model details",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Not authenticated or invalid token"},
        404: {"description": "Model not found"},
        500: {"description": "Internal server error"},
    },
)
async def get_model(
    model_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get a single BPMN model by its ID.

    This endpoint retrieves detailed information about a specific BPMN model.
    Authentication is required.

    Args:
        model_id: UUID of the model to retrieve
        current_user: Authenticated user from JWT token dependency
        db: Database session

    Returns:
        BPMNModelResponse: Model with all fields

    Raises:
        HTTPException: If model not found (404) or database operation fails (500)
    """
    try:
        model = await BPMNModelService.get_model_with_reports(db, model_id)

        if not model:
            raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="BPMN model not found")

        return model

    except HTTPException:
        raise
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to retrieve BPMN model", error=e
        )


@router.put(
    "/{model_id}",
    summary="Update BPMN model metadata",
    response_model=BPMNModelResponse,
    response_description="Updated BPMN model",
    status_code=status.HTTP_200_OK,
    responses={
        400: {"description": "Invalid request data or no fields to update"},
        401: {"description": "Not authenticated or invalid token"},
        404: {"description": "Model not found"},
        500: {"description": "Internal server error"},
    },
)
async def update_model(
    model_id: UUID,
    model_data: BPMNModelUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Update BPMN model metadata (name, description, version).

    This endpoint updates only the metadata fields of a BPMN model.
    To replace the file, use the file replacement endpoint.
    All fields are optional - only provided fields will be updated.
    Authentication is required.

    Args:
        model_id: UUID of the model to update
        model_data: Model metadata update (all fields optional)
        current_user: Authenticated user from JWT token dependency
        db: Database session

    Returns:
        BPMNModelResponse: Updated model with all fields

    Raises:
        HTTPException: If model not found (404), validation fails (400), or database operation fails (500)
    """
    try:
        # Validate that at least one field is provided
        update_data = model_data.model_dump(exclude_unset=True)
        if not update_data:
            raise_http_error(status_code=status.HTTP_400_BAD_REQUEST, message="No fields provided for update")

        updated_model = await BPMNModelService.update_model(db, model_id, model_data)

        if not updated_model:
            raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="BPMN model not found")
        return BPMNModelResponse.model_validate(updated_model)

    except HTTPException:
        raise
    except ValueError as e:
        raise_http_error(status_code=status.HTTP_400_BAD_REQUEST, message="Invalid update data", error=e)
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to update BPMN model", error=e
        )


@router.get(
    "/{model_id}/file",
    summary="Download a BPMN model file",
    response_description="Raw BPMN XML bytes",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Not authenticated or invalid token"},
        404: {"description": "Model not found"},
        500: {"description": "Internal server error"},
    },
)
async def download_file(
    model_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Stream the stored BPMN file back to the client."""
    try:
        result = await BPMNModelService.get_file_bytes(db, model_id)
        if result is None:
            raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="BPMN model not found")
        filename, content = result
        return Response(
            content=content,
            media_type="application/xml",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except FileNotFoundError:
        raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="BPMN file is missing on disk")
    except HTTPException:
        raise
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to download BPMN file", error=e
        )


@router.put(
    "/{model_id}/file",
    summary="Update BPMN model file",
    response_model=BPMNModelResponse,
    response_description="Updated BPMN model",
    status_code=status.HTTP_200_OK,
    responses={
        400: {"description": "Invalid file"},
        401: {"description": "Not authenticated or invalid token"},
        404: {"description": "Model not found"},
        500: {"description": "Internal server error"},
    },
)
async def update_file(
    model_id: UUID,
    file: Annotated[UploadFile, File(...)],
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Replace BPMN model file and regenerate description.

    This endpoint replaces the BPMN file and automatically regenerates the description.
    It updates: file_path, file_size, description, and uploaded_by.
    The old file is deleted from storage.
    Authentication is required.

    Args:
        model_id: UUID of the model to update
        file: New BPMN file to upload
        current_user: Authenticated user from JWT token dependency
        db: Database session

    Returns:
        BPMNModelResponse: Updated model with new file and description

    Raises:
        HTTPException: If model not found (404), validation fails (400), or operation fails (500)
    """
    try:
        updated_model = await BPMNModelService.update_file(
            db=db, model_id=model_id, file=file, user_id=UUID(current_user.sub)
        )

        if not updated_model:
            raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="BPMN model not found")
        return BPMNModelResponse.model_validate(updated_model)

    except HTTPException:
        raise
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to replace BPMN model file", error=e
        )


@router.delete(
    "/{model_id}",
    summary="Delete a BPMN model by ID",
    response_model=BPMNModelDeleteResponse,
    response_description="Deletion confirmation with model details",
    status_code=status.HTTP_200_OK,
    responses={
        401: {"description": "Not authenticated or invalid token"},
        404: {"description": "Model not found"},
        500: {"description": "Internal server error"},
    },
)
async def delete_model(
    model_id: UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Delete a BPMN model by its ID.

    This endpoint deletes a specific BPMN model from the database.
    Authentication is required.

    Args:
        model_id: UUID of the model to delete
        current_user: Authenticated user from JWT token dependency
        db: Database session

    Returns:
        BPMNModelDeleteResponse: Success status, message, and deleted model ID

    Raises:
        HTTPException: If model not found (404) or database operation fails (500)
    """
    try:
        deleted = await BPMNModelService.delete_model(db, model_id)

        if not deleted:
            raise_http_error(status_code=status.HTTP_404_NOT_FOUND, message="BPMN model not found")
        return BPMNModelDeleteResponse(success=True, message="Model deleted successfully", id=model_id)

    except HTTPException:
        raise
    except Exception as e:
        raise_http_error(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, message="Failed to delete BPMN model", error=e
        )
