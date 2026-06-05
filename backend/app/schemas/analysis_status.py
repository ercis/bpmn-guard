"""Analysis status schemas for type-safe endpoints."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

StepStatus = Literal["running", "completed"]


class AnalysisStatusResponse(BaseModel):
    """Response schema for analysis status."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(..., description="Unique identifier for the analysis")
    model_id: UUID = Field(..., description="UUID of the BPMN model being analyzed")
    model_name: str = Field(..., description="Name of the model")
    status: str = Field(..., description="Current status: 'running', 'completed', or 'failed'")
    steps_completed: list[str] = Field(
        default_factory=list, description="List of completed step names for progress calculation"
    )
    steps_status: dict[str, StepStatus] = Field(..., description="Per-step status from individual columns")
    report_id: UUID | None = Field(None, description="UUID of the evaluation report (set on completion)")
    error: str | None = Field(None, description="Error message if the analysis failed")
    created_at: datetime = Field(..., description="Timestamp when the analysis started")
    updated_at: datetime = Field(..., description="Timestamp of last status update")


class RunningAnalysesResponse(BaseModel):
    """Response schema for list of running analyses."""

    analyses: list[AnalysisStatusResponse] = Field(..., description="List of running analyses")
    total: int = Field(..., description="Total number of running analyses")


class StartAnalysisRequest(BaseModel):
    """Request to start a new analysis."""

    model_id: UUID = Field(..., description="UUID of the BPMN model to analyze")


class StartAnalysisResponse(BaseModel):
    """Response when starting a new analysis."""

    analysis_id: UUID = Field(..., description="UUID of the started analysis")
    status: str = Field(default="started", description="Status of the request")
