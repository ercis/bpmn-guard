"""Evaluation Report database model."""

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSON, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import BaseModel

if TYPE_CHECKING:
    from app.db.models.bpmn_model import BPMNModel
    from app.db.models.chat_message import ChatMessage
    from app.db.models.issue_exclusion import IssueExclusion


class EvaluationReport(BaseModel):
    """
    Database model for BPMN evaluation reports.

    Attributes:
        id: Unique UUID identifier for this evaluation report (inherited from BaseModel)
        model_id: UUID of the BPMN model this report evaluates
        uploaded_by: UUID of the user who created this report
        file_path: Path to the file for frontend rendering
        model_description: LLM-generated description of the model
        evaluation_summary: Overall evaluation summary
        evaluation_rating: Overall rating (1-10)
        syntax_check_result: JSON data from syntax/validation check
        duplicate_check_result: JSON data from duplicate check
        semantic_label_check_result: JSON data from semantic label check
        custom_rules_check_result: JSON data from custom rules check
        complexity_check_result: JSON data from complexity check
        bpmn_model: Relationship to the BPMN model
    """

    __tablename__ = "evaluation_reports"

    model_id: Mapped[UUID] = mapped_column(ForeignKey("bpmn_models.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True, index=True)

    # File path for frontend rendering
    file_path: Mapped[str] = mapped_column(Text)

    # Model Description
    model_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Overall Evaluation
    evaluation_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluation_rating: Mapped[int | None] = mapped_column(nullable=True)

    # Check Results (stored as JSON)
    syntax_check_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    duplicate_check_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    semantic_label_check_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    custom_rules_check_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    complexity_check_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationship to BPMN model
    bpmn_model: Mapped["BPMNModel"] = relationship("BPMNModel", back_populates="evaluation_reports")

    # Relationship to issue exclusions
    exclusions: Mapped[list["IssueExclusion"]] = relationship(
        "IssueExclusion",
        back_populates="evaluation_report",
        cascade="all, delete-orphan",
    )

    # Relationship to chat messages
    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="evaluation_report",
        cascade="all, delete-orphan",
    )

    @validates("evaluation_rating")
    def validate_rating(self, _key: str, value: int | None) -> int | None:
        """Validate that evaluation rating is between 1 and 10."""
        if value is not None and (value < 1 or value > 10):
            raise ValueError(f"Evaluation rating must be between 1 and 10, got {value}")
        return value

    @validates(
        "syntax_check_result",
        "duplicate_check_result",
        "semantic_label_check_result",
        "custom_rules_check_result",
        "complexity_check_result",
    )
    def validate_json_result(self, key: str, value: Any) -> dict | None:
        """Validate that JSON results are dictionaries or None."""
        if value is not None and not isinstance(value, dict):
            raise ValueError(f"{key} must be a dictionary, got {type(value).__name__}")
        return value
