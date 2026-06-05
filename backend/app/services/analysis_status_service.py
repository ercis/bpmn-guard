"""Service for analysis status tracking operations."""

import logging
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.analysis import Analysis

logger = logging.getLogger(__name__)

# Map step names to column names
STEP_COLUMNS = {
    "duplicate_check": "step_duplicate_check",
    "semantic_label_check": "step_semantic_label_check",
    "complexity_check": "step_complexity_check",
    "custom_checks": "step_custom_checks",
    "validation_check": "step_validation_check",
    "overall_evaluation": "step_overall_evaluation",
}


class AnalysisStatusService:
    """Manages analysis status in Postgres."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def start_analysis(
        self,
        analysis_id: UUID,
        model_id: UUID,
        model_name: str,
    ) -> Analysis:
        """
        Register a new running analysis.

        Args:
            analysis_id: Pre-generated UUID for the analysis
            model_id: UUID of the BPMN model being analyzed
            model_name: Name of the model (denormalized for quick access)

        Returns:
            Created Analysis record
        """
        analysis = Analysis(
            id=analysis_id,
            model_id=model_id,
            model_name=model_name,
            status="running",
            # Step columns default to "running" automatically
        )
        self.db.add(analysis)
        await self.db.commit()
        await self.db.refresh(analysis)
        logger.info(f"Started analysis {analysis_id} for model {model_id}")
        return analysis

    async def complete_step(self, analysis_id: UUID, step_name: str) -> None:
        """
        Mark a step as completed. No locking needed - each step has its own column.

        Args:
            analysis_id: UUID of the analysis
            step_name: Name of the completed step
        """
        column_name = STEP_COLUMNS.get(step_name)
        if not column_name:
            logger.warning(f"Unknown step: {step_name}")
            return

        await self.db.execute(update(Analysis).where(Analysis.id == analysis_id).values(**{column_name: "completed"}))
        await self.db.commit()
        logger.debug(f"Analysis {analysis_id} completed step: {step_name}")

    async def complete_analysis(self, analysis_id: UUID, report_id: UUID) -> None:
        """
        Mark analysis as completed with report ID.

        Also marks all step columns as completed to ensure consistent state.

        Args:
            analysis_id: UUID of the analysis
            report_id: UUID of the generated evaluation report
        """
        # Mark all steps as completed along with the overall status
        step_updates = {column_name: "completed" for column_name in STEP_COLUMNS.values()}
        await self.db.execute(
            update(Analysis)
            .where(Analysis.id == analysis_id)
            .values(status="completed", report_id=report_id, **step_updates)
        )
        await self.db.commit()
        logger.info(f"Analysis {analysis_id} completed with report {report_id}")

    async def fail_analysis(self, analysis_id: UUID, error: str) -> None:
        """
        Mark analysis as failed with error message.

        Args:
            analysis_id: UUID of the analysis
            error: Error message describing the failure
        """
        await self.db.execute(update(Analysis).where(Analysis.id == analysis_id).values(status="failed", error=error))
        await self.db.commit()
        logger.error(f"Analysis {analysis_id} failed: {error}")

    async def get_analysis_status(self, analysis_id: UUID) -> Analysis | None:
        """
        Get status of a specific analysis.

        Args:
            analysis_id: UUID of the analysis

        Returns:
            Analysis record or None if not found
        """
        result = await self.db.execute(select(Analysis).where(Analysis.id == analysis_id))
        return result.scalar_one_or_none()

    async def get_running_analyses(self) -> list[Analysis]:
        """
        Get all currently running analyses.

        Returns:
            List of running Analysis records, ordered by creation time (newest first)
        """
        result = await self.db.execute(
            select(Analysis).where(Analysis.status == "running").order_by(Analysis.created_at.desc())
        )
        return list(result.scalars().all())
