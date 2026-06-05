import pytest
from pathlib import Path

from app.schemas.custom_checks import CustomCheck, CustomChecksResult, CustomCheckCategory
from app.services.custom_checks_service import CustomChecksService

"""
Execute from backend directory:
uv run pytest tests/integration/services/test_custom_checks_service.py -v

Covers all deterministic custom rules (no LLM calls) using real .bpmn resources:
- activity-count
- gateway-naming
- task-name-length
"""


def _get_check(result: CustomChecksResult, check_key: str) -> CustomCheck:
    matches = [c for c in result.checks if c.check_key == check_key]
    assert len(matches) == 1, (
        f"Expected exactly one check with key '{check_key}', got {[c.check_key for c in result.checks]}"
    )
    return matches[0]


def _issue_ids(check: CustomCheck) -> set[str]:
    return {i.check_id for i in check.issues}


@pytest.fixture
def service() -> CustomChecksService:
    return CustomChecksService()


@pytest.fixture
def resources_path() -> Path:
    return Path(__file__).parent.parent.parent / "resources" / "custom_checks"


class TestCustomChecksService:
    def test_activity_count_valid_minimum_passes(self, service: CustomChecksService, resources_path: Path):
        xml = (resources_path / "activity_count_valid_6.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="activity_count_valid_6.bpmn")
        check = _get_check(result, "activity-count")

        assert check.passed is True
        assert check.issues == []

    def test_activity_count_too_low_fails_with_expected_issue(self, service: CustomChecksService, resources_path: Path):
        xml = (resources_path / "activity_count_too_low_1.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="activity_count_too_low_1.bpmn")
        check = _get_check(result, "activity-count")

        assert check.passed is False
        assert "activity-count-too-low" in _issue_ids(check)
        issue = next(i for i in check.issues if i.check_id == "activity-count-too-low")
        assert issue.category == CustomCheckCategory.WARNING

    def test_activity_count_too_high_fails_with_expected_issue(
        self, service: CustomChecksService, resources_path: Path
    ):
        xml = (resources_path / "activity_count_too_high_30.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="activity_count_too_high_30.bpmn")
        check = _get_check(result, "activity-count")

        assert check.passed is False
        assert "activity-count-too-high" in _issue_ids(check)
        issue = next(i for i in check.issues if i.check_id == "activity-count-too-high")
        assert issue.category == CustomCheckCategory.WARNING

    def test_gateway_naming_valid_question_and_labeled_outgoing_passes(
        self, service: CustomChecksService, resources_path: Path
    ):
        xml = (resources_path / "gateway_valid_question_and_labeled_outgoing.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="gateway_valid_question_and_labeled_outgoing.bpmn")
        check = _get_check(result, "gateway-naming")

        assert check.passed is True
        assert check.issues == []

    def test_gateway_naming_missing_question_marks_error(self, service: CustomChecksService, resources_path: Path):
        xml = (resources_path / "gateway_missing_question_mark.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="gateway_missing_question_mark.bpmn")
        check = _get_check(result, "gateway-naming")

        assert check.passed is False
        assert "gateway-missing-question" in _issue_ids(check)
        issue = next(i for i in check.issues if i.check_id == "gateway-missing-question")
        assert issue.category == CustomCheckCategory.ERROR
        assert issue.element_id == "Gw_1"

    def test_gateway_naming_outgoing_missing_label_warns(self, service: CustomChecksService, resources_path: Path):
        xml = (resources_path / "gateway_outgoing_missing_label.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="gateway_outgoing_missing_label.bpmn")
        check = _get_check(result, "gateway-naming")

        assert check.passed is False
        assert "outgoing-sequence-missing-label" in _issue_ids(check)
        issue = next(i for i in check.issues if i.check_id == "outgoing-sequence-missing-label")
        assert issue.category == CustomCheckCategory.WARNING
        assert issue.element_id == "Flow_no"

    def test_task_name_length_valid_short_passes(self, service: CustomChecksService, resources_path: Path):
        xml = (resources_path / "task_name_short.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="task_name_short.bpmn")
        check = _get_check(result, "task-name-length")

        assert check.passed is True
        assert check.issues == []

    def test_task_name_length_long_name_warns(self, service: CustomChecksService, resources_path: Path):
        xml = (resources_path / "task_name_long_warn_31.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="task_name_long_warn_31.bpmn")
        check = _get_check(result, "task-name-length")

        assert check.passed is False
        assert "task-name-long" in _issue_ids(check)
        issue = next(i for i in check.issues if i.check_id == "task-name-long")
        assert issue.category == CustomCheckCategory.WARNING
        assert issue.element_id == "Task_1"

    def test_task_name_length_too_long_errors(self, service: CustomChecksService, resources_path: Path):
        xml = (resources_path / "task_name_too_long_error_101.bpmn").read_text(encoding="utf-8")

        result = service.validate_content(xml, filename="task_name_too_long_error_101.bpmn")
        check = _get_check(result, "task-name-length")

        assert check.passed is False
        assert "task-name-too-long" in _issue_ids(check)
        issue = next(i for i in check.issues if i.check_id == "task-name-too-long")
        assert issue.category == CustomCheckCategory.ERROR
        assert issue.element_id == "Task_1"
