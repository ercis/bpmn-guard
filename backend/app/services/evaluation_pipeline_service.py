import logging
from collections.abc import Callable, Coroutine
from typing import Any, cast
from uuid import UUID

from langgraph.graph.state import CompiledStateGraph
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.bpmn_model import BPMNModel
from app.db.models.evaluation_report import EvaluationReport as EvaluationReportDB
from app.schemas.evaluation import (
    EvaluationReport,
    EvaluationReportWorkflow,
    ModelDescription,
    ModelEvaluation,
)
from app.schemas.validation import ValidationResult
from app.schemas.duplicate_check import DuplicateCheckResult
from app.schemas.semantic_label_check_schemas import SemanticLabelCheckResult
from app.schemas.custom_checks import CustomChecksResult
from app.schemas.complexity_check import ComplexityCheckResult
from app.agents.workflows.evaluation_workflow import EvaluationWorkflowState

logger = logging.getLogger(__name__)


class EvaluationPipelineService:
    """Class to manage the evaluation pipeline for BPMN models."""

    @staticmethod
    def _deserialize_db_report(db_report: EvaluationReportDB) -> EvaluationReport:
        """
        Convert database model to Pydantic schema.

        Args:
            db_report: Database evaluation report model

        Returns:
            EvaluationReport: Pydantic schema with nested objects
        """
        # Use the report's own uploaded_by field directly
        uploaded_by = db_report.uploaded_by

        return EvaluationReport(
            id=db_report.id,
            model_id=db_report.model_id,
            file_path=db_report.file_path,
            file_name=db_report.bpmn_model.name if db_report.bpmn_model else None,
            uploaded_by=uploaded_by,
            model_description=ModelDescription(description=db_report.model_description)
            if db_report.model_description
            else ModelDescription(description=""),
            model_evaluation=ModelEvaluation.model_validate(
                {
                    "evaluation_summary": db_report.evaluation_summary,
                    "evaluation_rating": db_report.evaluation_rating,
                }
            )
            if db_report.evaluation_summary and db_report.evaluation_rating
            else None,
            syntax_check=ValidationResult.model_validate(db_report.syntax_check_result)
            if db_report.syntax_check_result
            else None,
            duplicate_check=DuplicateCheckResult.model_validate(db_report.duplicate_check_result)
            if db_report.duplicate_check_result
            else None,
            semantic_label_check=SemanticLabelCheckResult.model_validate(db_report.semantic_label_check_result)
            if db_report.semantic_label_check_result
            else None,
            custom_rules_check=CustomChecksResult.model_validate(db_report.custom_rules_check_result)
            if db_report.custom_rules_check_result
            else None,
            complexity_check=ComplexityCheckResult.model_validate(db_report.complexity_check_result)
            if db_report.complexity_check_result
            else None,
            created_at=db_report.created_at,
            updated_at=db_report.updated_at,
        )

    def _run_evaluation_workflow(self, graph: CompiledStateGraph, bpmn_model: BPMNModel) -> EvaluationReportWorkflow:
        """
        Execute the evaluation workflow for a BPMN model.

        Args:
            graph: Pre-compiled LangGraph workflow
            bpmn_model: BPMN model to evaluate

        Returns:
            EvaluationReportWorkflow: Workflow result with all check results

        Raises:
            ValueError: If workflow execution fails or returns invalid state
        """
        try:
            initial_state: EvaluationWorkflowState = {
                "bpmn_model": bpmn_model,
                "model_description": ModelDescription(description=bpmn_model.description or ""),
                # Individual check results - populated by parallel nodes
                "duplicate_check_result": None,
                "semantic_label_check_result": None,
                "complexity_check_result": None,
                "custom_checks_result": None,
                "validation_check_result": None,
                # Final result - populated by overall_evaluation node
                "result": None,  # type: ignore[typeddict-item]
            }
            final_state = graph.invoke(initial_state)

            if not final_state or "result" not in final_state:
                raise ValueError("Workflow execution failed: Invalid final state returned")

            return final_state["result"]
        except Exception as e:
            logger.error(f"Workflow execution failed for model {bpmn_model.id}: {str(e)}")
            raise ValueError(f"Evaluation workflow failed: {str(e)}") from e

    async def _save_evaluation_result(
        self,
        db: AsyncSession,
        workflow_result: EvaluationReportWorkflow,
        bpmn_model: BPMNModel,
        uploaded_by: UUID | None = None,
    ) -> EvaluationReport:
        """
        Save evaluation workflow results to the database.

        Args:
            db: Database session
            workflow_result: Results from the evaluation workflow
            bpmn_model: BPMN model that was evaluated
            uploaded_by: UUID of the user who created this report

        Returns:
            EvaluationReport: Saved evaluation report with id and file_path
        """
        # Create database record
        db_report = EvaluationReportDB(
            model_id=workflow_result.model_id,
            file_path=bpmn_model.file_path,
            uploaded_by=uploaded_by,
            model_description=workflow_result.model_description.description,
            evaluation_summary=workflow_result.model_evaluation.evaluation_summary
            if workflow_result.model_evaluation
            else None,
            evaluation_rating=workflow_result.model_evaluation.evaluation_rating
            if workflow_result.model_evaluation
            else None,
            syntax_check_result=workflow_result.syntax_check.model_dump() if workflow_result.syntax_check else None,
            duplicate_check_result=workflow_result.duplicate_check.model_dump()
            if workflow_result.duplicate_check
            else None,
            semantic_label_check_result=workflow_result.semantic_label_check.model_dump()
            if workflow_result.semantic_label_check
            else None,
            custom_rules_check_result=workflow_result.custom_rules_check.model_dump()
            if workflow_result.custom_rules_check
            else None,
            complexity_check_result=workflow_result.complexity_check.model_dump()
            if workflow_result.complexity_check
            else None,
        )

        db.add(db_report)
        await db.commit()
        await db.refresh(db_report)

        logger.info(f"Saved evaluation report {db_report.id} for model {bpmn_model.id}")

        # Return API response schema with all required fields including timestamps
        return EvaluationReport(
            id=db_report.id,
            file_path=db_report.file_path,
            file_name=bpmn_model.name,
            model_id=workflow_result.model_id,
            uploaded_by=uploaded_by,
            model_description=workflow_result.model_description,
            model_evaluation=workflow_result.model_evaluation,
            syntax_check=workflow_result.syntax_check,
            duplicate_check=workflow_result.duplicate_check,
            semantic_label_check=workflow_result.semantic_label_check,
            custom_rules_check=workflow_result.custom_rules_check,
            complexity_check=workflow_result.complexity_check,
            created_at=db_report.created_at,
            updated_at=db_report.updated_at,
        )

    async def evaluate_and_save(
        self,
        db: AsyncSession,
        graph: CompiledStateGraph,
        bpmn_model: BPMNModel,
        uploaded_by: UUID | None = None,
    ) -> EvaluationReport:
        """
        Execute evaluation workflow and save results to database.

        Args:
            db: Database session
            graph: Pre-compiled evaluation workflow graph
            bpmn_model: BPMN model to evaluate
            uploaded_by: UUID of the user who created this report

        Returns:
            EvaluationReport: Complete evaluation report with id
        """
        # Run the workflow
        workflow_result = self._run_evaluation_workflow(graph, bpmn_model)

        # Save to database and return
        return await self._save_evaluation_result(db, workflow_result, bpmn_model, uploaded_by)

    async def evaluate_with_status_updates(
        self,
        graph: CompiledStateGraph,
        bpmn_model: BPMNModel,
        analysis_id: UUID,
        tracked_nodes: set[str],
        on_step_complete: Callable[[UUID, str], Coroutine[Any, Any, None]],
        on_complete: Callable[[UUID, UUID], Coroutine[Any, Any, None]],
        on_fail: Callable[[UUID, str], Coroutine[Any, Any, None]],
        uploaded_by: UUID | None = None,
    ) -> EvaluationReport:
        """
        Execute evaluation workflow with status updates after each step.

        Uses LangGraph's astream with stream_mode="updates" to detect node
        completion. Each chunk is {"node_name": {state_delta}}.

        Args:
            graph: Pre-compiled LangGraph workflow
            bpmn_model: BPMN model to evaluate
            analysis_id: UUID of the analysis for status tracking
            tracked_nodes: Set of node names to track for progress updates
            on_step_complete: Async callback(analysis_id, step_name) called when a tracked step completes
            on_complete: Async callback(analysis_id, report_id) called when evaluation completes
            on_fail: Async callback(analysis_id, error_message) called when evaluation fails
            uploaded_by: UUID of the user who created this report

        Returns:
            EvaluationReport: Complete evaluation report with id

        Raises:
            ValueError: If workflow execution fails or returns invalid state
        """
        initial_state: EvaluationWorkflowState = {
            "bpmn_model": bpmn_model,
            "model_description": ModelDescription(description=bpmn_model.description or ""),
            # Individual check results - populated by parallel nodes
            "duplicate_check_result": None,
            "semantic_label_check_result": None,
            "complexity_check_result": None,
            "custom_checks_result": None,
            "validation_check_result": None,
            # Final result - populated by overall_evaluation node
            "result": None,  # type: ignore[typeddict-item]
        }
        final_state = dict(initial_state)

        try:
            # Stream node updates - each chunk is {"node_name": {state_delta}}
            async for chunk in graph.astream(initial_state, stream_mode="updates"):
                for node_name, state_delta in chunk.items():
                    # Update tracked steps (don't fail entire run for status update issues)
                    if node_name in tracked_nodes:
                        try:
                            await on_step_complete(analysis_id, node_name)
                        except Exception as e:
                            logger.warning(f"Failed to update step {node_name}: {e}")

                    # Merge state delta - each node writes to its own key, no conflicts
                    final_state.update(state_delta)

            if "result" not in final_state:
                raise ValueError("Workflow completed but no result found")

            workflow_result = cast(EvaluationReportWorkflow, final_state["result"])

            # Save report to database
            from app.db.session import AsyncSessionLocal

            async with AsyncSessionLocal() as db:
                report = await self._save_evaluation_result(db, workflow_result, bpmn_model, uploaded_by)

            # Ensure callback failures don't roll back the saved report
            try:
                await on_complete(analysis_id, report.id)
            except Exception as callback_error:
                logger.error(
                    f"Failed to execute on_complete for analysis {analysis_id}, report {report.id}: {callback_error}"
                )

            logger.info(f"Evaluation completed for analysis {analysis_id}, report {report.id}")
            return report

        except Exception as e:
            logger.error(f"Evaluation failed for analysis {analysis_id}: {str(e)}")
            await on_fail(analysis_id, str(e))
            raise ValueError(f"Evaluation workflow failed: {str(e)}") from e

    SORTABLE_FIELDS: dict[str, Any] = {
        "file_name": BPMNModel.name,
        "evaluation_rating": EvaluationReportDB.evaluation_rating,
        "created_at": EvaluationReportDB.created_at,
        "updated_at": EvaluationReportDB.updated_at,
    }

    @staticmethod
    async def get_all_reports(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 15,
        uploaded_by: UUID | None = None,
        sort_by: str = "created_at",
        sort_direction: str = "desc",
    ) -> tuple[list[EvaluationReport], int]:
        """
        Get paginated evaluation reports from the database.

        Args:
            db: Async database session
            page: Page number (1-based)
            page_size: Number of items per page
            uploaded_by: Optional filter by user UUID
            sort_by: Field to sort by (file_name, evaluation_rating, created_at, updated_at)
            sort_direction: Sort direction (asc or desc)

        Returns:
            Tuple of (list of evaluation reports, total count)
        """
        try:
            query = select(EvaluationReportDB).options(selectinload(EvaluationReportDB.bpmn_model))
            count_query = select(func.count()).select_from(EvaluationReportDB)

            if uploaded_by is not None:
                query = query.where(EvaluationReportDB.uploaded_by == uploaded_by)
                count_query = count_query.where(EvaluationReportDB.uploaded_by == uploaded_by)

            # Get total count
            total_result = await db.execute(count_query)
            total = total_result.scalar_one()

            # Get paginated results with sorting
            offset = (page - 1) * page_size
            sort_column = EvaluationPipelineService.SORTABLE_FIELDS.get(sort_by, EvaluationReportDB.created_at)
            # Sorting by a joined column (e.g. file_name -> BPMNModel.name) requires a join
            if sort_by == "file_name":
                query = query.join(EvaluationReportDB.bpmn_model)
            order = sort_column.asc() if sort_direction == "asc" else sort_column.desc()
            query = query.order_by(order).offset(offset).limit(page_size)
            result = await db.execute(query)
            db_reports = result.scalars().all()

            logger.info(f"Retrieved {len(db_reports)} evaluation reports (page {page}, total {total})")

            reports = [EvaluationPipelineService._deserialize_db_report(db_report) for db_report in db_reports]
            return reports, total
        except Exception as e:
            logger.error(f"Error retrieving evaluation reports: {e}")
            raise

    @staticmethod
    async def get_report_by_id(db: AsyncSession, report_id: UUID) -> EvaluationReport | None:
        """
        Get an evaluation report by its ID.

        Args:
            db: Async database session
            report_id: UUID of the evaluation report

        Returns:
            Evaluation report or None if not found
        """
        try:
            result = await db.execute(
                select(EvaluationReportDB)
                .where(EvaluationReportDB.id == report_id)
                .options(selectinload(EvaluationReportDB.bpmn_model))
            )
            db_report = result.scalar_one_or_none()

            if db_report:
                logger.info(f"Retrieved evaluation report: {report_id}")
                return EvaluationPipelineService._deserialize_db_report(db_report)
            else:
                logger.warning(f"Evaluation report not found: {report_id}")
                return None
        except Exception as e:
            logger.error(f"Error retrieving evaluation report {report_id}: {e}")
            raise

    @staticmethod
    async def delete_report(db: AsyncSession, report_id: UUID) -> bool:
        """
        Delete an evaluation report by its ID.

        Args:
            db: Async database session
            report_id: UUID of the evaluation report to delete

        Returns:
            True if the report was deleted, False if not found
        """
        try:
            result = await db.execute(select(EvaluationReportDB).where(EvaluationReportDB.id == report_id))
            db_report = result.scalar_one_or_none()

            if not db_report:
                logger.warning(f"Evaluation report not found for deletion: {report_id}")
                return False

            await db.delete(db_report)
            await db.commit()

            logger.info(f"Deleted evaluation report: {report_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting evaluation report {report_id}: {e}")
            await db.rollback()
            raise

    @staticmethod
    def setup_evaluation_pipeline_service() -> "EvaluationPipelineService":
        """Initialize an EvaluationPipelineService object using default settings.

        Returns:
            :return: EvaluationPipelineService object.
        """
        return EvaluationPipelineService()
