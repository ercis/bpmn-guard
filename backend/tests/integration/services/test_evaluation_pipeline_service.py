import pytest
from pathlib import Path
from unittest.mock import Mock
from uuid import uuid4

from app.agents.workflows.evaluation_workflow import EvaluationWorkflow
from app.db.models.bpmn_model import BPMNModel
from app.schemas.complexity_check import ComplexityCheckResult
from app.schemas.custom_checks import CustomChecksResult
from app.schemas.duplicate_check import DuplicateCheckResult
from app.schemas.semantic_label_check_schemas import SemanticLabelCheckResult
from app.schemas.validation import ValidationResult
from app.schemas.evaluation import ModelEvaluation, ModelDescription


"""
Execute (locally):
uv run pytest tests/integration/services/test_evaluation_pipeline_service.py -v

This test runs the full EvaluationWorkflow graph with a real BPMN input (simple_test.bpmn)
while mocking the external/unstable checks (duplicate check + semantic label check).
It asserts that each check type in the EvaluationReport returns a result.
"""


@pytest.fixture
def simple_test_bpmn_xml() -> str:
    bpmn_file = Path(__file__).resolve().parent.parent.parent / "resources" / "bpmn_validation" / "simple_test.bpmn"
    return bpmn_file.read_text(encoding="utf-8")


def _mock_bpmn_model(xml: str) -> BPMNModel:
    model = Mock(spec=BPMNModel)
    model.id = uuid4()
    model.name = "simple_test.bpmn"
    model.description = (
        "This is a test BPMN model description that is intentionally long enough to satisfy schema limits. "
        "It should be at least 50 characters long."
    )
    model.bpmn_xml = xml
    model.file_path = "tests/resources/bpmn_validation/simple_test.bpmn"
    return model


@pytest.fixture
def evaluation_graph(monkeypatch):
    """Compile workflow but patch nodes that require DB/LLM/external services."""

    # 1) Duplicate check: depends on DB + embeddings + LLM
    def fake_duplicate_check(state):
        return {
            "duplicate_check_result": DuplicateCheckResult(
                response_answer="No duplicates found (mock).",
                similar_models=[],
            )
        }

    # 2) Semantic label check: depends on LLM
    def fake_semantic_label_check(state):
        return {
            "semantic_label_check_result": SemanticLabelCheckResult(
                rating=100,
                evaluation="All semantic label rules pass (mock).",
                violations=[],
            )
        }

    monkeypatch.setattr(EvaluationWorkflow, "node_duplicate_check", staticmethod(fake_duplicate_check))
    monkeypatch.setattr(EvaluationWorkflow, "node_semantic_label_check", staticmethod(fake_semantic_label_check))

    return EvaluationWorkflow.compile_workflow()


class TestEvaluationPipelineService:
    def test_full_evaluation_pipeline_all_checks_return(self, evaluation_graph, simple_test_bpmn_xml):
        bpmn_model = _mock_bpmn_model(simple_test_bpmn_xml)

        # Build the initial state for parallel execution workflow
        initial_state = {
            "bpmn_model": bpmn_model,
            "model_description": ModelDescription(description=bpmn_model.description),
            "duplicate_check_result": None,
            "semantic_label_check_result": None,
            "complexity_check_result": None,
            "custom_checks_result": None,
            "validation_check_result": None,
            "result": None,
        }

        final_state = evaluation_graph.invoke(initial_state)
        report = final_state["result"]

        # Assert: every check type returned something
        assert report.duplicate_check is not None
        assert report.semantic_label_check is not None
        assert report.complexity_check is not None
        assert report.custom_rules_check is not None
        assert report.syntax_check is not None
        assert report.model_evaluation is not None

        # Stronger assertions: types and basic invariants
        assert isinstance(report.syntax_check, ValidationResult)
        assert isinstance(report.custom_rules_check, CustomChecksResult)
        assert isinstance(report.complexity_check, ComplexityCheckResult)
        assert isinstance(report.duplicate_check, DuplicateCheckResult)
        assert isinstance(report.semantic_label_check, SemanticLabelCheckResult)
        assert isinstance(report.model_evaluation, ModelEvaluation)

        assert 1 <= report.model_evaluation.evaluation_rating <= 10
        assert isinstance(report.model_evaluation.evaluation_summary, str)
        assert len(report.model_evaluation.evaluation_summary) > 0

        # sanity: syntax_check should be valid for simple_test.bpmn in our repo
        assert report.syntax_check.is_valid is True
        assert report.syntax_check.error_count == 0
        assert report.syntax_check.total_issues == 0

        # sanity: complexity_check should have non-negative scores
        assert report.complexity_check.cw_score >= 0
        assert report.complexity_check.cfc_score >= 0
