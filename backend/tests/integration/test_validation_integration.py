"""Integration tests for BPMN validation.
Execute:

go to the backend folder
uv run pytest tests/integration/test_validation_integration.py -v
"""

import pytest
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.services.bpmn_validation_services import BPMNValidationService, BPMNValidationError
from app.schemas.validation import ValidationRule, ValidationIssue, ValidationResult


class TestBPMNValidator:
    """Test suite for BPMN validation."""

    @pytest.fixture
    def validator(self):
        """Fixture: Initialize BPMN validator."""
        return BPMNValidationService()

    @pytest.fixture
    def sample_bpmn_file(self):
        """Fixture: Path to sample BPMN file."""
        return "../bpmn_examples/__bung_1_920e781ac88741f18ff6143eacad5539.bpmn"

    @pytest.fixture
    def sample_bpmn_content(self, sample_bpmn_file):
        """Fixture: Read sample BPMN content."""
        with open(sample_bpmn_file, "r") as f:
            return f.read()

    def test_validator_initialization(self):
        """Test 1: Validator initializes without errors."""
        validator = BPMNValidationService()
        assert validator is not None
        assert validator.validate_script is not None

    def test_validate_file(self, validator, sample_bpmn_file):
        """Test 2: Validate BPMN file."""
        result = validator.validate_file(sample_bpmn_file)

        assert result is not None
        assert "file" in result
        assert "valid" in result
        assert "reports" in result
        assert isinstance(result["reports"], dict)

    def test_validation_result_contains_issues(self, validator, sample_bpmn_file):
        """Test 2b: Validation identifies issues in sample file."""
        result = validator.validate_file(sample_bpmn_file)

        assert result["valid"] is False
        assert len(result["reports"]) > 0

    def test_get_summary(self, validator, sample_bpmn_file):
        """Test 3: Generate validation summary."""
        result = validator.validate_file(sample_bpmn_file)
        summary = validator.get_summary(result)

        assert summary is not None
        assert "is_valid" in summary
        assert "error_count" in summary
        assert "warning_count" in summary
        assert "total_issues" in summary

        # Verify counts are non-negative
        assert summary["error_count"] >= 0
        assert summary["warning_count"] >= 0
        assert summary["total_issues"] >= 0

    def test_summary_is_valid_flag(self, validator, sample_bpmn_file):
        """Test 3b: Summary correctly reflects validity."""
        result = validator.validate_file(sample_bpmn_file)
        summary = validator.get_summary(result)

        # If there are errors, is_valid should be False
        if summary["error_count"] > 0:
            assert summary["is_valid"] is False

    def test_transform_to_api_response(self, validator, sample_bpmn_file):
        """Test 4: Transform result to API response format."""
        result = validator.validate_file(sample_bpmn_file)
        summary = validator.get_summary(result)

        # Transform to response format
        issues = []
        for rule_name, rule_issues in result.get("reports", {}).items():
            issues.append(
                ValidationRule(
                    rule_name=rule_name,
                    issues=[
                        ValidationIssue(
                            id=issue.get("id", "unknown"),
                            message=issue.get("message", ""),
                            category=issue.get("category", "error"),
                        )
                        for issue in rule_issues
                    ],
                )
            )

        response = ValidationResult(
            file=str(result.get("file")),
            is_valid=result.get("valid", False),
            error_count=summary["error_count"],
            warning_count=summary["warning_count"],
            total_issues=summary["total_issues"],
            issues=issues,
        )

        assert isinstance(response, ValidationResult)
        assert response.file is not None
        assert isinstance(response.issues, list)
        assert len(response.issues) == len(result["reports"])

    def test_validate_content_string(self, validator, sample_bpmn_content):
        """Test 5: Validate BPMN content from string."""
        result = validator.validate_content(sample_bpmn_content, filename="test.bpmn")

        assert result is not None
        assert "valid" in result
        assert "file" in result
        assert result["file"] == "test.bpmn"

    def test_validate_content_returns_same_results(self, validator, sample_bpmn_file, sample_bpmn_content):
        """Test 5b: Content validation produces same results as file validation."""
        file_result = validator.validate_file(sample_bpmn_file)
        content_result = validator.validate_content(sample_bpmn_content, filename=sample_bpmn_file)

        # Both should have same validity
        assert file_result["valid"] == content_result["valid"]
        # Both should have same number of issues
        assert len(file_result["reports"]) == len(content_result["reports"])

    def test_error_handling_missing_file(self, validator):
        """Test 6: Error handling for missing files."""
        with pytest.raises(BPMNValidationError):
            validator.validate_file("nonexistent.bpmn")

    def test_error_handling_invalid_path(self, validator):
        """Test 6b: Error handling for invalid paths."""
        with pytest.raises(BPMNValidationError):
            validator.validate_file("")

    def test_validation_categories(self, validator, sample_bpmn_file):
        """Test 7: Validation issues have correct categories."""
        result = validator.validate_file(sample_bpmn_file)

        for rule_name, issues in result["reports"].items():
            for issue in issues:
                assert "category" in issue
                assert issue["category"] in ["error", "warn"]

    def test_validation_issue_structure(self, validator, sample_bpmn_file):
        """Test 8: Validation issues have required fields."""
        result = validator.validate_file(sample_bpmn_file)

        for rule_name, issues in result["reports"].items():
            for issue in issues:
                assert "id" in issue
                assert "message" in issue
                assert "category" in issue

    def test_validator_timeout(self, validator, sample_bpmn_file):
        """Test 9: Validator respects timeout parameter."""
        # This should complete within timeout
        result = validator.validate_file(sample_bpmn_file, timeout=60)
        assert result is not None

    @pytest.mark.parametrize("timeout_value", [10, 30, 60])
    def test_validator_multiple_timeouts(self, validator, sample_bpmn_file, timeout_value):
        """Test 10: Validator works with different timeout values."""
        result = validator.validate_file(sample_bpmn_file, timeout=timeout_value)
        assert result is not None
        assert "valid" in result


class TestBPMNValidatorIntegration:
    """Integration tests for the full validation pipeline."""

    @pytest.fixture
    def validator(self):
        """Fixture: Initialize validator."""
        return BPMNValidationService()

    def test_full_validation_pipeline(self, validator):
        """Test: Full validation pipeline from file to API response."""
        sample_file = "../bpmn_examples/__bung_1_920e781ac88741f18ff6143eacad5539.bpmn"

        # Step 1: Validate file
        result = validator.validate_file(sample_file)
        assert result is not None

        # Step 2: Generate summary
        summary = validator.get_summary(result)
        assert summary is not None

        # Step 3: Transform to API response
        issues = []
        for rule_name, rule_issues in result.get("reports", {}).items():
            issues.append(
                ValidationRule(
                    rule_name=rule_name,
                    issues=[
                        ValidationIssue(
                            id=issue.get("id", "unknown"),
                            message=issue.get("message", ""),
                            category=issue.get("category", "error"),
                        )
                        for issue in rule_issues
                    ],
                )
            )

        response = ValidationResult(
            file=str(result.get("file")),
            is_valid=result.get("valid", False),
            error_count=summary["error_count"],
            warning_count=summary["warning_count"],
            total_issues=summary["total_issues"],
            issues=issues,
        )

        # Verify final response
        assert isinstance(response, ValidationResult)
        assert response.error_count >= 0
        assert response.warning_count >= 0
        assert response.total_issues == response.error_count + response.warning_count

    def test_validation_consistency(self, validator):
        """Test: Multiple validations of same file produce consistent results."""
        sample_file = "../bpmn_examples/__bung_1_920e781ac88741f18ff6143eacad5539.bpmn"

        result1 = validator.validate_file(sample_file)
        result2 = validator.validate_file(sample_file)

        # Results should be identical
        assert result1["valid"] == result2["valid"]
        assert len(result1["reports"]) == len(result2["reports"])
        assert result1["reports"].keys() == result2["reports"].keys()


class TestEndpoints:
    """Tests for FastAPI validation endpoints."""

    @pytest.fixture
    def validator(self):
        """Fixture: Initialize validator."""
        return BPMNValidationService()

    def test_validate_bpmn_file_endpoint_logic(self, validator):
        """Test: Logic of /validate endpoint with file path."""
        sample_file = "../bpmn_examples/__bung_1_920e781ac88741f18ff6143eacad5539.bpmn"

        # Simulate endpoint logic: validate file
        result = validator.validate_file(sample_file)

        # Transform to response format (same as endpoint does)
        issues = []
        for rule_name, rule_issues in result.get("reports", {}).items():
            issues.append(
                ValidationRule(
                    rule_name=rule_name,
                    issues=[
                        ValidationIssue(
                            id=issue.get("id", "unknown"),
                            message=issue.get("message", ""),
                            category=issue.get("category", "error"),
                        )
                        for issue in rule_issues
                    ],
                )
            )

        summary = validator.get_summary(result)

        response = ValidationResult(
            file=str(result.get("file")),
            is_valid=result.get("valid", False),
            error_count=summary["error_count"],
            warning_count=summary["warning_count"],
            total_issues=summary["total_issues"],
            issues=issues,
        )

        # Verify response structure (what endpoint would return)
        assert isinstance(response, ValidationResult)
        assert response.file is not None
        assert isinstance(response.is_valid, bool)
        assert isinstance(response.error_count, int)
        assert isinstance(response.warning_count, int)
        assert isinstance(response.total_issues, int)
        assert isinstance(response.issues, list)
        assert response.total_issues == response.error_count + response.warning_count

    def test_validate_bpmn_upload_endpoint_logic(self, validator):
        """Test: Logic of /validate-upload endpoint with file content."""
        sample_file = "../bpmn_examples/__bung_1_920e781ac88741f18ff6143eacad5539.bpmn"

        # Simulate endpoint logic: read uploaded file and validate content
        with open(sample_file, "rb") as f:
            content = f.read()

        bpmn_content = content.decode("utf-8")

        # Validate content (as if uploaded)
        result = validator.validate_content(bpmn_content, filename="uploaded_test.bpmn")

        # Transform to response format (same as endpoint does)
        issues = []
        for rule_name, rule_issues in result.get("reports", {}).items():
            issues.append(
                ValidationRule(
                    rule_name=rule_name,
                    issues=[
                        ValidationIssue(
                            id=issue.get("id", "unknown"),
                            message=issue.get("message", ""),
                            category=issue.get("category", "error"),
                        )
                        for issue in rule_issues
                    ],
                )
            )

        summary = validator.get_summary(result)

        response = ValidationResult(
            file="uploaded_test.bpmn",
            is_valid=result.get("valid", False),
            error_count=summary["error_count"],
            warning_count=summary["warning_count"],
            total_issues=summary["total_issues"],
            issues=issues,
        )

        # Verify response structure (what endpoint would return)
        assert isinstance(response, ValidationResult)
        assert response.file == "uploaded_test.bpmn"
        assert isinstance(response.is_valid, bool)
        assert isinstance(response.error_count, int)
        assert isinstance(response.warning_count, int)
        assert isinstance(response.total_issues, int)
        assert isinstance(response.issues, list)
        assert response.total_issues == response.error_count + response.warning_count
