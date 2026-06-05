"""Chat message database model."""

from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.base import BaseModel

if TYPE_CHECKING:
    from app.db.models.evaluation_report import EvaluationReport


class ChatRole(str, Enum):
    """Enum for chat message roles."""

    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(BaseModel):
    """
    Database model for chat messages.

    Attributes:
        id: Unique UUID identifier (inherited from BaseModel)
        created_at: Timestamp when the message was created (inherited)
        updated_at: Timestamp when the message was last updated (inherited)
        report_id: UUID of the evaluation report this message belongs to
        role: Role of the message sender ('user' or 'assistant')
        content: The message content
        evaluation_report: Relationship to the evaluation report
    """

    __tablename__ = "chat_messages"

    report_id: Mapped[UUID] = mapped_column(
        ForeignKey("evaluation_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationship
    evaluation_report: Mapped["EvaluationReport"] = relationship(
        "EvaluationReport",
        back_populates="chat_messages",
    )

    @validates("role")
    def validate_role(self, _key: str, value: str) -> str:
        """Validate that role is either 'user' or 'assistant'."""
        valid_roles = {role.value for role in ChatRole}
        if value not in valid_roles:
            raise ValueError(f"Role must be one of {valid_roles}, got '{value}'")
        return value
