import pytest
from pathlib import Path

from app.services.bpmn_validation_services import (
    BPMNValidationService,
    BPMNValidationError,
    setup_bpmn_validation,
)


"""
Execute from the repository root (with docker compose up running):

    docker compose exec backend uv run pytest tests/integration/services/test_bpmn_validation_service.py -v

These tests validate that BPMNValidationService correctly invokes the Node-based bpmnlint
validator (external/bpmn_lint/validate.js) and transforms results into our Pydantic schema.

Rule configuration under app/external/bpmn_lint/.bpmnlintrc:
  - label-required: warn
  - no-implicit-end: error
  - no-disconnected: error
  - start-event-required: error
  - end-event-required: error
  - no-gateway-join-fork: error
  - superfluous-gateway: warn
"""


def _rule_names(result) -> set[str]:
    return {r.rule_name for r in result.issues}


def _get_rule(result, rule_name: str):
    matches = [r for r in result.issues if r.rule_name == rule_name]
    assert matches, f"Expected rule '{rule_name}' in result. Available: {[r.rule_name for r in result.issues]}"
    return matches[0]


@pytest.fixture(scope="session", autouse=True)
def ensure_bpmnlint_installed():
    # Ensures external/bpmn_lint has node_modules installed.
    # This is intentionally done once per test session.
    setup_bpmn_validation()


@pytest.fixture
def service() -> BPMNValidationService:
    return BPMNValidationService()


@pytest.fixture
def resources_path() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "resources" / "bpmn_validation"


class TestBPMNValidationService:
    def test_valid_minimal_process_is_valid(self, service: BPMNValidationService, resources_path: Path):
        xml = (resources_path / "simple_test.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="simple_test.bpmn")

        assert result.file == "simple_test.bpmn"
        assert result.is_valid is True
        assert result.error_count == 0
        assert result.total_issues == 0

    def test_start_event_required_error(self, service: BPMNValidationService, resources_path: Path):
        """Violates: start-event-required (error)."""
        xml = (resources_path / "missing_start.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="missing_start.bpmn")

        assert result.is_valid is False
        assert result.error_count >= 1
        assert "start-event-required" in _rule_names(result)

    def test_end_event_required_error(self, service: BPMNValidationService, resources_path: Path):
        """Violates: end-event-required (error)."""
        xml = (resources_path / "missing_end.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="missing_end.bpmn")

        assert result.is_valid is False
        assert result.error_count >= 1
        assert "end-event-required" in _rule_names(result)

    def test_label_required_warns(self, service: BPMNValidationService, resources_path: Path):
        """Violates: label-required (warn)."""
        xml = (resources_path / "label_required.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="label_required.bpmn")

        assert result.is_valid is False or result.total_issues > 0
        assert "label-required" in _rule_names(result)
        rule = _get_rule(result, "label-required")
        assert len(rule.issues) >= 1
        assert all(i.category.value == "warning" for i in rule.issues)

    def test_no_implicit_end_error(self, service: BPMNValidationService, resources_path: Path):
        """Violates: no-implicit-end (error)."""
        xml = (resources_path / "implicit_end.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="implicit_end.bpmn")

        assert result.is_valid is False
        assert "no-implicit-end" in _rule_names(result)

    def test_no_disconnected_error(self, service: BPMNValidationService, resources_path: Path):
        """Violates: no-disconnected (error)."""
        xml = (resources_path / "no_disconnected.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="no_disconnected.bpmn")

        assert result.is_valid is False
        assert result.error_count >= 1
        assert "no-disconnected" in _rule_names(result)

    def test_no_gateway_join_fork_error(self, service: BPMNValidationService, resources_path: Path):
        """Violates: no-gateway-join-fork (error)."""
        xml = (resources_path / "gateway_join_fork_invalid.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="gateway_join_fork_invalid.bpmn")

        assert result.is_valid is False
        assert result.error_count >= 1
        assert "no-gateway-join-fork" in _rule_names(result)

    def test_superfluous_gateway_warns(self, service: BPMNValidationService, resources_path: Path):
        """Violates: superfluous-gateway (warn)."""
        xml = (resources_path / "superfluous_gateway_warn.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="superfluous_gateway_warn.bpmn")

        assert "superfluous-gateway" in _rule_names(result)
        rule = _get_rule(result, "superfluous-gateway")
        assert len(rule.issues) >= 1
        assert all(i.category.value == "warning" for i in rule.issues)

    def test_invalid_xml_raises_validation_error(self, service: BPMNValidationService):
        # validate.js returns result.error when moddle can't parse; service converts that to BPMNValidationError.
        invalid_xml = "<not-xml"  # deliberately broken

        with pytest.raises(BPMNValidationError):
            service.validate_content(invalid_xml, filename="invalid_xml.bpmn")
