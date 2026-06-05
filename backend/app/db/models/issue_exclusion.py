"""Issue Exclusion database model for human-in-the-loop report review."""

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import BaseModel

if TYPE_CHECKING:
    from app.db.models.evaluation_report import EvaluationReport


class IssueExclusion(BaseModel):
    """
    Database model for tracking excluded issues in evaluation reports.

    Allows users to mark individual issues as excluded/irrelevant during review.
    The exclusion can be undone by deleting this record.

    Attributes:
        id: Unique UUID identifier (inherited from BaseModel)
        report_id: UUID of the evaluation report this exclusion belongs to
        check_type: Type of check (syntax_check, semantic_label_check, custom_rules_check)
        issue_identifier: JSON containing path to locate the issue in the report
        issue_snapshot: JSON containing full issue data for audit purposes
        reason: Optional reason for excluding the issue
        excluded_by: User ID of who excluded the issue
        evaluation_report: Relationship to the parent EvaluationReport
    """

    __tablename__ = "issue_exclusions"

    report_id: Mapped[UUID] = mapped_column(
        ForeignKey("evaluation_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    check_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    issue_identifier: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    issue_snapshot: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    excluded_by: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Relationship to evaluation report
    evaluation_report: Mapped["EvaluationReport"] = relationship(
        "EvaluationReport",
        back_populates="exclusions",
    )

    @validates("check_type")
    def validate_check_type(self, key: str, value: str) -> str:
        """Validate that check_type is one of the allowed values."""
        allowed_types = {"syntax_check", "semantic_label_check", "custom_rules_check", "duplicate_check"}
        if value not in allowed_types:
            raise ValueError(f"check_type must be one of {allowed_types}, got '{value}'")
        return value

    @validates("issue_identifier", "issue_snapshot")
    def validate_json_fields(self, key: str, value: Any) -> dict:
        """Validate that JSON fields are dictionaries."""
        if not isinstance(value, dict):
            raise ValueError(f"{key} must be a dictionary, got {type(value).__name__}")
        return value
