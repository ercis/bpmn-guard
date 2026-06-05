from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.complexity_check import ComplexityCheckResult
from app.schemas.custom_checks import CustomChecksResult
from app.schemas.duplicate_check import DuplicateCheckResult
from app.schemas.semantic_label_check_schemas import SemanticLabelCheckResult
from app.schemas.validation import ValidationResult


class ModelDescription(BaseModel):
    """
    Result model for evaluating a BPMN model.
    """

    description: str | None = Field(
        default=None,
        min_length=50,
        max_length=700,
        description="Description of the model",
    )


class ModelEvaluation(BaseModel):
    """
    The evaluation of a BPMN model including a summary and an overall rating.
    """

    evaluation_summary: str = Field(description="Overall evaluation summarizing the results of all checks")
    evaluation_rating: int = Field(
        description="Overall rating of the BPMN model on a scale from 1 (poor) to 10 (excellent)",
        ge=1,
        le=10,
    )


class EvaluationReportWorkflow(BaseModel):
    """
    Comprehensive evaluation report for a BPMN model, including the result of all checks and an overall summary.
    Used during workflow execution before persistence.
    """

    model_id: UUID = Field(description="Unique identifier of the BPMN model being evaluated")
    model_description: ModelDescription = Field(description="The LLM-based description of the BPMN model")
    model_evaluation: ModelEvaluation | None = Field(description="The overall evaluation of the BPMN model")
    syntax_check: ValidationResult | None = Field(description="Results rule based BPMN syntax/best practices check")
    duplicate_check: DuplicateCheckResult | None = Field(description="Results from the duplicate check process")
    semantic_label_check: SemanticLabelCheckResult | None = Field(
        description="Results from the semantic label check process"
    )
    custom_rules_check: CustomChecksResult | None = Field(description="Results from the custom BPMN validation checks")
    complexity_check: ComplexityCheckResult | None = Field(description="Results from the complexity check process")


class EvaluationReport(EvaluationReportWorkflow):
    """
    Persisted evaluation report with database identifiers.
    Extends EvaluationReportWorkflow with id, file_path, and timestamps.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(description="Unique identifier for this evaluation report")
    file_path: str = Field(description="Path to the BPMN file being evaluated")
    file_name: str | None = Field(default=None, description="Display name derived from the associated BPMN model")
    uploaded_by: UUID | None = Field(
        default=None,
        description="UUID of the user who created this evaluation report",
    )
    created_at: datetime = Field(description="Timestamp when the report was created")
    updated_at: datetime = Field(description="Timestamp when the report was last updated")


class EvaluationRequest(BaseModel):
    """Request body for evaluation endpoint."""

    model_id: UUID = Field(description="UUID of the BPMN model to evaluate")


class EvaluationReportListResponse(BaseModel):
    """Schema for listing multiple evaluation reports."""

    total: int = Field(description="Total number of evaluation reports")
    items: list[EvaluationReport] = Field(description="List of evaluation reports")


class EvaluationReportDeleteResponse(BaseModel):
    """Schema for delete operation response."""

    success: bool = Field(..., description="Whether the deletion was successful")
    message: str = Field(..., description="Deletion status message")
    id: UUID = Field(..., description="ID of the deleted report")
