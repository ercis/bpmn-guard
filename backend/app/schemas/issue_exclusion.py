"""Pydantic schemas for issue exclusion operations."""

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CheckType(str, Enum):
    """Enum for the types of checks that can have excluded issues."""

    SYNTAX_CHECK = "syntax_check"
    SEMANTIC_LABEL_CHECK = "semantic_label_check"
    CUSTOM_RULES_CHECK = "custom_rules_check"
    DUPLICATE_CHECK = "duplicate_check"


class IssueExclusionCreate(BaseModel):
    """Schema for creating a new issue exclusion."""

    check_type: CheckType = Field(description="Type of check the issue belongs to")
    issue_identifier: dict = Field(description="JSON object identifying the issue within the check results")
    issue_snapshot: dict = Field(description="Full issue data snapshot for audit purposes")
    reason: str | None = Field(
        default=None,
        max_length=500,
        description="Optional reason for excluding the issue",
    )


class IssueExclusionResponse(BaseModel):
    """Schema for issue exclusion response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(description="Unique identifier for this exclusion")
    report_id: UUID = Field(description="ID of the evaluation report")
    check_type: CheckType = Field(description="Type of check the issue belongs to")
    issue_identifier: dict = Field(description="JSON identifying the issue")
    issue_snapshot: dict = Field(description="Full issue data snapshot")
    reason: str | None = Field(description="Reason for exclusion")
    excluded_by: str = Field(description="User ID who excluded the issue")
    created_at: datetime = Field(description="When the exclusion was created")
    updated_at: datetime = Field(description="When the exclusion was last updated")


class IssueExclusionListResponse(BaseModel):
    """Schema for listing issue exclusions."""

    total: int = Field(description="Total number of exclusions")
    items: list[IssueExclusionResponse] = Field(description="List of exclusions")


class IssueExclusionDeleteResponse(BaseModel):
    """Schema for delete operation response."""

    success: bool = Field(description="Whether the deletion was successful")
    message: str = Field(description="Deletion status message")
    id: UUID = Field(description="ID of the deleted exclusion")


class BulkExclusionCreate(IssueExclusionCreate):
    """Schema for a single exclusion in bulk operations."""

    pass


class BulkExclusionRequest(BaseModel):
    """Schema for bulk updating exclusions (save all changes from review page)."""

    to_create: list[BulkExclusionCreate] = Field(
        default_factory=list,
        description="List of new exclusions to create",
    )
    to_delete: list[UUID] = Field(
        default_factory=list,
        description="List of exclusion IDs to delete (restore issues)",
    )


class BulkExclusionResponse(BaseModel):
    """Schema for bulk operation response."""

    success: bool = Field(description="Whether the operation was successful")
    created_count: int = Field(description="Number of exclusions created")
    deleted_count: int = Field(description="Number of exclusions deleted")
    skipped_count: int = Field(description="Number of duplicate exclusions skipped")
    exclusions: list[IssueExclusionResponse] = Field(description="Current list of all exclusions for the report")
