"""Schemas for custom BPMN validation checks."""

from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional


class CustomCheckCategory(str, Enum):
    """Category of custom check issue."""

    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class CustomCheckIssue(BaseModel):
    """Single custom check issue."""

    check_id: str = Field(min_length=1, max_length=50, description="Unique identifier for the check")
    message: str = Field(min_length=5, max_length=500, description="Detailed message about the issue")
    category: CustomCheckCategory = Field(description="Severity level: error, warning, or info")
    element_id: Optional[str] = Field(default=None, description="ID of the BPMN element involved")
    element_name: Optional[str] = Field(default=None, description="Name of the BPMN element involved")


class CustomCheck(BaseModel):
    """Single custom check with its issues."""

    check_name: str = Field(min_length=1, max_length=100, description="Name of the custom check")
    check_key: str = Field(min_length=1, max_length=50, description="Unique key for the check")
    description: str = Field(min_length=5, max_length=500, description="Description of what is checked")
    passed: bool = Field(description="Whether the check passed")
    issues: list[CustomCheckIssue] = Field(default_factory=list, description="List of issues found")


class CustomChecksResult(BaseModel):
    """Result model for custom BPMN checks."""

    file: str = Field(min_length=1, max_length=255, description="Path to the BPMN model file")
    checks_passed: int = Field(default=0, description="Number of checks that passed")
    checks_failed: int = Field(default=0, description="Number of checks that failed")
    total_checks: int = Field(default=0, description="Total number of custom checks run")
    error_count: int = Field(default=0, description="Total number of errors")
    warning_count: int = Field(default=0, description="Total number of warnings")
    info_count: int = Field(default=0, description="Total number of info messages")
    total_issues: int = Field(default=0, description="Total number of issues across all checks")
    checks: list[CustomCheck] = Field(default_factory=list, description="List of custom checks and their results")
    error_message: Optional[str] = Field(default=None, description="Error message if validation failed")
