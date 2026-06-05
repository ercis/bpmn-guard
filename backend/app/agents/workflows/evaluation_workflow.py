import logging

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from typing import TypedDict
from langsmith import traceable

from app.language_model_client.client import LLMClient
from app.services.duplicate_check_service import setup_duplicate_check_service
from app.db.models.bpmn_model import BPMNModel

from app.schemas.evaluation import EvaluationReportWorkflow, ModelDescription
from app.schemas.complexity_check import ComplexityCheckResult
from app.schemas.custom_checks import CustomChecksResult
from app.schemas.duplicate_check import DuplicateCheckResult
from app.schemas.semantic_label_check_schemas import SemanticLabelCheckResult
from app.schemas.validation import ValidationResult
from app.services import complexity_check_services
from app.services.bpmn_validation_services import BPMNValidationService
from app.services.custom_checks_service import CustomChecksService
from app.services.semantic_label_check_service import SemanticLabelCheckService
from app.services.evaluation_summary_service import EvaluationSummaryService

logger = logging.getLogger(__name__)


class EvaluationWorkflowState(TypedDict):
    """
    State for information exchange between nodes in the evaluation workflow.

    Each check writes to its own field to avoid conflicts during parallel execution.
    The overall_evaluation node reads all results and creates the final report.
    """

    # Input - read-only during checks
    bpmn_model: BPMNModel
    model_description: ModelDescription

    # Individual check results - each node writes only its own field
    duplicate_check_result: DuplicateCheckResult | None
    semantic_label_check_result: SemanticLabelCheckResult | None
    complexity_check_result: ComplexityCheckResult | None
    custom_checks_result: CustomChecksResult | None
    validation_check_result: ValidationResult | None

    # Final output - written by overall_evaluation
    result: EvaluationReportWorkflow


class EvaluationWorkflow:
    """Class for compiling an evaluation workflow for BPMN models."""

    @staticmethod
    def compile_workflow() -> CompiledStateGraph:
        """
        Compile the evaluation workflow with parallel execution.

        Creates a fan-out/fan-in pattern where all checks run simultaneously,
        then converge at overall_evaluation:

                    ┌─► duplicate_check ────┐
                    ├─► semantic_label_check─┤
            START ──┼─► complexity_check ────┼──► overall_evaluation ──► END
                    ├─► custom_checks ───────┤
                    └─► validation_check ────┘
        """
        builder = StateGraph(EvaluationWorkflowState)

        # Add nodes
        builder.add_node("duplicate_check", EvaluationWorkflow.node_duplicate_check)
        builder.add_node("custom_checks", EvaluationWorkflow.node_custom_checks)
        builder.add_node("semantic_label_check", EvaluationWorkflow.node_semantic_label_check)
        builder.add_node("validation_check", EvaluationWorkflow.node_validation_check)
        builder.add_node("complexity_check", EvaluationWorkflow.node_complexity_check)
        builder.add_node("overall_evaluation", EvaluationWorkflow.node_overall_evaluation)

        # Parallel execution: all checks run simultaneously from START
        builder.add_edge(START, "duplicate_check")
        builder.add_edge(START, "semantic_label_check")
        builder.add_edge(START, "complexity_check")
        builder.add_edge(START, "custom_checks")
        builder.add_edge(START, "validation_check")

        # All checks must complete before overall evaluation
        builder.add_edge("duplicate_check", "overall_evaluation")
        builder.add_edge("semantic_label_check", "overall_evaluation")
        builder.add_edge("complexity_check", "overall_evaluation")
        builder.add_edge("custom_checks", "overall_evaluation")
        builder.add_edge("validation_check", "overall_evaluation")

        builder.add_edge("overall_evaluation", END)

        return builder.compile()

    @staticmethod
    @traceable(name="Node: Duplicate Check")
    def node_duplicate_check(state: EvaluationWorkflowState) -> dict:
        """Node to perform duplicate check using the DuplicateCheckService."""
        bpmn_model = state["bpmn_model"]
        duplicate_check_service = setup_duplicate_check_service()

        duplicate_check_result = duplicate_check_service.duplicate_check(bpmn_model)
        if not duplicate_check_result:
            raise ValueError("Duplicate check failed or returned no result.")

        return {"duplicate_check_result": duplicate_check_result}

    @staticmethod
    @traceable(name="Node: Custom Checks")
    def node_custom_checks(state: EvaluationWorkflowState) -> dict:
        """Node to perform custom checks using the CustomChecksService."""
        bpmn_model = state["bpmn_model"]
        custom_check_service = CustomChecksService()

        if not bpmn_model.bpmn_xml:
            raise ValueError("BPMN model does not have XML content available")
        custom_check_result = custom_check_service.validate_content(bpmn_model.bpmn_xml, filename=bpmn_model.name)

        return {"custom_checks_result": custom_check_result}

    @staticmethod
    @traceable(name="Node: Semantic Label Check")
    def node_semantic_label_check(state: EvaluationWorkflowState) -> dict:
        """Node to perform semantic label check."""
        semantic_label_check_service = SemanticLabelCheckService.setup_semantic_label_check_service()
        bpmn_model = state["bpmn_model"]
        semantic_label_check_result = semantic_label_check_service.check_semantic_label(bpmn_model)

        return {"semantic_label_check_result": semantic_label_check_result}

    @staticmethod
    @traceable(name="Node: Validation Check")
    def node_validation_check(state: EvaluationWorkflowState) -> dict:
        """Node to perform BPMN validation check."""
        validation_service = BPMNValidationService()
        bpmn_model = state["bpmn_model"]
        if not bpmn_model.bpmn_xml:
            raise ValueError("BPMN model does not have XML content available")
        validation_result = validation_service.validate_content(bpmn_model.bpmn_xml, filename=bpmn_model.name)

        return {"validation_check_result": validation_result}

    @staticmethod
    @traceable(name="Node: Complexity Check")
    def node_complexity_check(state: EvaluationWorkflowState) -> dict:
        """Node to perform BPMN complexity check."""
        bpmn_model = state["bpmn_model"]
        complexity_result = complexity_check_services.evaluate_scientific_complexity(bpmn_model)
        if not complexity_result:
            raise ValueError("Complexity check failed or returned no result.")

        return {"complexity_check_result": complexity_result}

    @staticmethod
    @traceable(name="Node: Overall Evaluation")
    def node_overall_evaluation(state: EvaluationWorkflowState) -> dict:
        """Node to create overall summary + rating from all checks using weighted average and LLM summary."""
        # Create LLM client for generating the summary
        try:
            llm_client = LLMClient().create_llm_model()
        except Exception as e:
            logger.warning(f"Failed to create LLM client for summary generation: {e}. Using fallback.")
            llm_client = None

        # Create the overall evaluation from all check results
        model_evaluation = EvaluationSummaryService.create_overall_evaluation(
            syntax_check=state["validation_check_result"],
            custom_rules_check=state["custom_checks_result"],
            complexity_check=state["complexity_check_result"],
            duplicate_check=state["duplicate_check_result"],
            semantic_label_check=state["semantic_label_check_result"],
            llm_client=llm_client,
        )

        # Build the final result combining all checks
        result = EvaluationReportWorkflow(
            model_id=state["bpmn_model"].id,
            model_description=state["model_description"],
            model_evaluation=model_evaluation,
            syntax_check=state["validation_check_result"],
            duplicate_check=state["duplicate_check_result"],
            semantic_label_check=state["semantic_label_check_result"],
            custom_rules_check=state["custom_checks_result"],
            complexity_check=state["complexity_check_result"],
        )

        return {"result": result}
