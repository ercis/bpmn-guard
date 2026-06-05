"""BPMN Model database model."""

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel

if TYPE_CHECKING:
    from app.db.models.evaluation_report import EvaluationReport
    from app.db.models.analysis import Analysis


class BPMNModel(BaseModel):
    """
    Database model for BPMN models.

    Attributes:
        name: Name of the BPMN model
        description: Description of the model
        file_path: Path to the file in Supabase storage (unique)
        file_size: Size of the file in bytes
        version: Version of the model (default: '1.0')
        uploaded_by: UUID of the user who uploaded the model
        bpmn_xml: Cleaned BPMN XML content (nullable for backward compatibility)
        evaluation_reports: List of evaluation reports for this model
    """

    __tablename__ = "bpmn_models"

    name: Mapped[str]
    description: Mapped[str | None]
    file_path: Mapped[str] = mapped_column(unique=True, index=True)
    file_size: Mapped[int | None]
    version: Mapped[str] = mapped_column(default="1.0")
    uploaded_by: Mapped[UUID | None]
    bpmn_xml: Mapped[str | None]

    # Relationship to evaluation reports
    evaluation_reports: Mapped[list["EvaluationReport"]] = relationship(
        "EvaluationReport", back_populates="bpmn_model", cascade="all, delete-orphan"
    )

    # Relationship to analyses
    analyses: Mapped[list["Analysis"]] = relationship(
        "Analysis", back_populates="bpmn_model", cascade="all, delete-orphan"
    )
