import pytest
from uuid import uuid4
from unittest.mock import Mock, patch

from app.agents.workflows.evaluation_workflow import EvaluationWorkflow, EvaluationWorkflowState
from app.schemas.evaluation import EvaluationReportWorkflow, ModelDescription
from app.db.models.bpmn_model import BPMNModel


"""
Execute from backend directory:
uv run pytest tests/unit/test_evaluation_workflow.py -v
"""


class TestEvaluationWorkflowNodes:
    """Test the workflow orchestration logic in isolation using mocks."""

    @pytest.fixture
    def mock_bpmn_model(self):
        """Create a mock BPMN model."""
        model = Mock(spec=BPMNModel)
        model.id = uuid4()
        model.name = "test_model.bpmn"
        model.description = "This is a valid description in terms of length for a process for order handling workflow"
        model.bpmn_xml = """<?xml version="1.0" encoding="UTF-8"?>
        <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">
          <bpmn:process id="Process_1" isExecutable="true">
            <bpmn:startEvent id="StartEvent_1"/>
          </bpmn:process>
        </bpmn:definitions>"""
        return model

    @pytest.fixture
    def initial_state(self, mock_bpmn_model) -> EvaluationWorkflowState:
        """Create initial workflow state with individual result fields for parallel execution."""
        return {
            "bpmn_model": mock_bpmn_model,
            "model_description": ModelDescription(description=mock_bpmn_model.description),
            "duplicate_check_result": None,
            "semantic_label_check_result": None,
            "complexity_check_result": None,
            "custom_checks_result": None,
            "validation_check_result": None,
            "result": EvaluationReportWorkflow(
                model_id=mock_bpmn_model.id,
                model_description=ModelDescription(description=mock_bpmn_model.description),
                model_evaluation=None,
                syntax_check=None,
                duplicate_check=None,
                semantic_label_check=None,
                custom_rules_check=None,
                complexity_check=None,
            ),
        }

    @patch("app.agents.workflows.evaluation_workflow.setup_duplicate_check_service")
    def test_node_duplicate_check(self, mock_service, initial_state):
        """Test duplicate check node."""
        # Arrange
        mock_duplicate_service = Mock()
        mock_result = Mock()
        mock_duplicate_service.duplicate_check.return_value = mock_result
        mock_service.return_value = mock_duplicate_service

        # Act
        result_state = EvaluationWorkflow.node_duplicate_check(initial_state)

        # Assert
        assert result_state["duplicate_check_result"] == mock_result
        mock_duplicate_service.duplicate_check.assert_called_once()

    @patch("app.agents.workflows.evaluation_workflow.SemanticLabelCheckService")
    def test_node_semantic_label_check(self, mock_service_class, initial_state):
        """Test semantic label check node."""
        # Arrange
        mock_service = Mock()
        mock_result = Mock()
        mock_service.check_semantic_label.return_value = mock_result
        mock_service_class.setup_semantic_label_check_service.return_value = mock_service

        # Act
        result_state = EvaluationWorkflow.node_semantic_label_check(initial_state)

        # Assert
        assert result_state["semantic_label_check_result"] == mock_result

    @patch("app.agents.workflows.evaluation_workflow.complexity_check_services")
    def test_node_complexity_check(self, mock_service, initial_state):
        """Test complexity check node."""
        # Arrange
        mock_result = Mock()
        mock_service.evaluate_scientific_complexity.return_value = mock_result

        # Act
        result_state = EvaluationWorkflow.node_complexity_check(initial_state)

        # Assert
        assert result_state["complexity_check_result"] == mock_result

    def test_node_complexity_check_raises_on_none(self, initial_state):
        """Test complexity check raises error when service returns None."""
        with patch("app.agents.workflows.evaluation_workflow.complexity_check_services") as mock:
            mock.evaluate_scientific_complexity.return_value = None

            with pytest.raises(ValueError, match="Complexity check failed"):
                EvaluationWorkflow.node_complexity_check(initial_state)

    @patch("app.agents.workflows.evaluation_workflow.CustomChecksService")
    def test_node_custom_checks(self, mock_service_class, initial_state):
        """Test custom checks node."""
        # Arrange
        mock_service = Mock()
        mock_result = Mock()
        mock_service.validate_content.return_value = mock_result
        mock_service_class.return_value = mock_service

        # Act
        result_state = EvaluationWorkflow.node_custom_checks(initial_state)

        # Assert
        assert result_state["custom_checks_result"] == mock_result
        mock_service.validate_content.assert_called_once()

    @patch("app.agents.workflows.evaluation_workflow.BPMNValidationService")
    def test_node_validation_check(self, mock_service_class, initial_state):
        """Test validation check node."""
        # Arrange
        mock_service = Mock()
        mock_result = Mock()
        mock_service.validate_content.return_value = mock_result
        mock_service_class.return_value = mock_service

        # Act
        result_state = EvaluationWorkflow.node_validation_check(initial_state)

        # Assert
        assert result_state["validation_check_result"] == mock_result
        mock_service.validate_content.assert_called_once()

    @patch("app.agents.workflows.evaluation_workflow.EvaluationReportWorkflow")
    @patch("app.agents.workflows.evaluation_workflow.LLMClient")
    @patch("app.agents.workflows.evaluation_workflow.EvaluationSummaryService")
    def test_node_overall_evaluation(
        self, mock_summary_service_class, mock_llm_client_class, mock_report_class, initial_state
    ):
        """Test overall evaluation node."""
        # Arrange: seed state with fake results (individual fields for parallel execution)
        syntax = Mock()
        custom = Mock()
        complexity = Mock()
        duplicate = Mock()
        semantic = Mock()
        initial_state["validation_check_result"] = syntax
        initial_state["custom_checks_result"] = custom
        initial_state["complexity_check_result"] = complexity
        initial_state["duplicate_check_result"] = duplicate
        initial_state["semantic_label_check_result"] = semantic

        mock_overall = Mock()
        mock_summary_service_class.create_overall_evaluation.return_value = mock_overall

        mock_llm = Mock()
        mock_llm_client_class.return_value.create_llm_model.return_value = mock_llm

        mock_result = Mock()
        mock_report_class.return_value = mock_result

        # Act
        result_state = EvaluationWorkflow.node_overall_evaluation(initial_state)

        # Assert
        assert result_state["result"] == mock_result
        mock_summary_service_class.create_overall_evaluation.assert_called_once_with(
            syntax_check=syntax,
            custom_rules_check=custom,
            complexity_check=complexity,
            duplicate_check=duplicate,
            semantic_label_check=semantic,
            llm_client=mock_llm,
        )
        mock_report_class.assert_called_once_with(
            model_id=initial_state["bpmn_model"].id,
            model_description=initial_state["model_description"],
            model_evaluation=mock_overall,
            syntax_check=syntax,
            duplicate_check=duplicate,
            semantic_label_check=semantic,
            custom_rules_check=custom,
            complexity_check=complexity,
        )

    @patch("app.agents.workflows.evaluation_workflow.EvaluationReportWorkflow")
    @patch("app.agents.workflows.evaluation_workflow.LLMClient")
    @patch("app.agents.workflows.evaluation_workflow.EvaluationSummaryService")
    def test_node_overall_evaluation_llm_fallback(
        self, mock_summary_service_class, mock_llm_client_class, mock_report_class, initial_state
    ):
        """Test overall evaluation node falls back gracefully when LLM client fails."""
        # Arrange
        initial_state["validation_check_result"] = Mock()
        initial_state["custom_checks_result"] = Mock()
        initial_state["complexity_check_result"] = Mock()
        initial_state["duplicate_check_result"] = Mock()
        initial_state["semantic_label_check_result"] = Mock()

        mock_overall = Mock()
        mock_summary_service_class.create_overall_evaluation.return_value = mock_overall

        mock_result = Mock()
        mock_report_class.return_value = mock_result

        # Simulate LLM client creation failure
        mock_llm_client_class.return_value.create_llm_model.side_effect = Exception("LLM unavailable")

        # Act
        result_state = EvaluationWorkflow.node_overall_evaluation(initial_state)

        # Assert - should still work with llm_client=None
        assert result_state["result"] == mock_result
        mock_summary_service_class.create_overall_evaluation.assert_called_once()
        call_kwargs = mock_summary_service_class.create_overall_evaluation.call_args.kwargs
        assert call_kwargs["llm_client"] is None
