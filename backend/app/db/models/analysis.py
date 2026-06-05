"""Running Analysis database model."""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel

if TYPE_CHECKING:
    from app.db.models.bpmn_model import BPMNModel
    from app.db.models.evaluation_report import EvaluationReport


class Analysis(BaseModel):
    """
    Tracks the status of running BPMN evaluations.

    Uses individual columns per step to avoid race conditions during parallel execution.
    Each step defaults to 'running' since all parallel steps start immediately.

    Attributes:
        id: Unique UUID identifier (inherited from BaseModel)
        model_id: UUID of the BPMN model being evaluated
        model_name: Name of the model (denormalized for quick access)
        status: Current status ('running', 'completed', 'failed')
        step_*: Individual step status columns ('running', 'completed')
        report_id: UUID of the evaluation report (set on completion)
        error: Error message if the analysis failed
        created_at: Timestamp when analysis started (inherited from BaseModel)
        updated_at: Timestamp of last status update (inherited from BaseModel)
    """

    __tablename__ = "analyses"

    model_id: Mapped[UUID] = mapped_column(
        ForeignKey("bpmn_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="running",
        index=True,
    )

    # Individual step status columns - default to "running" since all start in parallel
    step_duplicate_check: Mapped[str] = mapped_column(String(20), default="running", nullable=False)
    step_semantic_label_check: Mapped[str] = mapped_column(String(20), default="running", nullable=False)
    step_complexity_check: Mapped[str] = mapped_column(String(20), default="running", nullable=False)
    step_custom_checks: Mapped[str] = mapped_column(String(20), default="running", nullable=False)
    step_validation_check: Mapped[str] = mapped_column(String(20), default="running", nullable=False)
    step_overall_evaluation: Mapped[str] = mapped_column(String(20), default="running", nullable=False)

    report_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("evaluation_reports.id", ondelete="SET NULL"),
        nullable=True,
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    bpmn_model: Mapped["BPMNModel"] = relationship(
        "BPMNModel",
        back_populates="analyses",
    )
    # Intentionally unidirectional: EvaluationReport does not define a back reference
    # to Analysis. Access from reports to analyses is done via the foreign key only.
    evaluation_report: Mapped["EvaluationReport | None"] = relationship(
        "EvaluationReport",
    )

    @property
    def steps_status(self) -> dict[str, str]:
        """Return steps as dict for API response."""
        return {
            "duplicate_check": self.step_duplicate_check,
            "semantic_label_check": self.step_semantic_label_check,
            "complexity_check": self.step_complexity_check,
            "custom_checks": self.step_custom_checks,
            "validation_check": self.step_validation_check,
            "overall_evaluation": self.step_overall_evaluation,
        }

    @property
    def steps_completed(self) -> list[str]:
        """Return list of completed steps for progress calculation."""
        return [k for k, v in self.steps_status.items() if v == "completed"]
