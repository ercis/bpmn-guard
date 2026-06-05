"""BPMN Model schemas for type-safe endpoints."""

from datetime import datetime

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class ReportSummary(BaseModel):
    """Summary of an evaluation report for embedding in model responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Report ID")
    evaluation_rating: int | None = Field(None, description="Rating 1-10")
    created_at: datetime = Field(..., description="When the report was created")


class BPMNModelBase(BaseModel):
    """Base schema for BPMN model with common attributes."""

    name: str = Field(..., description="Name of the BPMN model", min_length=1)
    description: Optional[str] = Field(None, description="Optional description of the model")
    version: str = Field(default="1.0", description="Version of the model")


class BPMNModelCreate(BaseModel):
    """
    Schema for creating a BPMN model via file upload.
    Used with UploadFile - contains metadata fields from form data.
    File path, file size, description, and uploaded_by are auto-generated during creation.
    Description is always auto-generated from the BPMN content via LLM.
    """

    name: str = Field(..., description="Name of the BPMN model", min_length=1)
    version: str = Field(default="1.0", description="Version of the model")
    uploaded_by: UUID = Field(..., description="ID of the user who uploaded the model")


class BPMNModelUpdate(BaseModel):
    """
    Schema for updating BPMN model metadata.
    All fields are optional - only provided fields will be updated.
    File path and size cannot be updated via this schema (use file replacement endpoint).
    """

    name: Optional[str] = Field(None, description="Name of the BPMN model", min_length=1)
    description: Optional[str] = Field(None, description="Optional description of the model")
    version: Optional[str] = Field(None, description="Version of the model", min_length=1)


class BPMNModelResponse(BPMNModelBase):
    """
    Schema for BPMN model responses.
    Includes all fields from database.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Unique identifier for the model")
    file_path: str = Field(..., description="Path to the file in Supabase storage")
    file_size: Optional[int] = Field(None, description="Size of the file in bytes")
    uploaded_by: Optional[UUID] = Field(None, description="UUID of the user who uploaded the model")
    created_at: datetime = Field(..., description="Timestamp when the model was created")
    updated_at: datetime = Field(..., description="Timestamp when the model was last updated")
    reports: list[ReportSummary] = Field(
        default_factory=list,
        description="List of evaluation report summaries for this model",
    )


class BPMNModelListResponse(BaseModel):
    """Schema for listing multiple BPMN models."""

    total: int = Field(..., description="Total number of models")
    items: list[BPMNModelResponse] = Field(..., description="List of BPMN models")


class BPMNModelDeleteResponse(BaseModel):
    """Schema for delete operation response."""

    success: bool = Field(..., description="Whether the deletion was successful")
    message: str = Field(..., description="Deletion status message")
    id: UUID = Field(..., description="ID of the deleted model")
