"""Evaluation schemas for pydantic validation."""

from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional


class IssueCategory(str, Enum):
    """
    Category of validation issue.
    """

    ERROR = "error"
    WARNING = "warning"


class ValidationIssue(BaseModel):
    """
    Single validation issue (error or warning).
    """

    id: str = Field(min_length=1, max_length=50, description="Unique identifier for the issue")
    message: str = Field(min_length=5, max_length=500, description="A message")
    category: IssueCategory = Field(description="Whether error or warning")


class ValidationRule(BaseModel):
    """
    Validation issues grouped by rule.
    """

    rule_name: str = Field(min_length=1, max_length=50, description="Name of the validation rule")
    issues: list[ValidationIssue] = Field(default_factory=list, description="List of validation issues")


class ValidationResult(BaseModel):
    """
    Result model for BPMN validation.
    """

    file: str = Field(min_length=1, max_length=255, description="Path to the BPMN model file")
    is_valid: bool = Field(default=False, description="Whether the BPMN model is valid")
    error_count: int = Field(default=0, description="Number of errors")
    warning_count: int = Field(default=0, description="Number of warnings")
    total_issues: int = Field(default=0, description="Total number of issues")
    issues: list[ValidationRule] = Field(default_factory=list, description="List of validation rules")
    error_message: Optional[str] = Field(default=None, description="Error message")
