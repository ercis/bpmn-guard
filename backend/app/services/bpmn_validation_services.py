"""BPMN validation service using bpmnlint."""

import json
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Any, Dict, List

import logging

from langsmith import traceable

from app.schemas.validation import ValidationResult, ValidationRule, ValidationIssue, IssueCategory

logger = logging.getLogger(__name__)


class BPMNValidationError(Exception):
    """Custom exception for BPMN validation errors."""

    pass


def _find_npm_command() -> List[str]:
    """
    Find the npm command for cross-platform use.

    Returns:
        List[str]: Command array to use with subprocess (e.g., ['npm'] or ['npm.cmd'])

    Raises:
        FileNotFoundError: If npm is not found
    """
    import shutil
    import sys

    # On Windows, try npm.cmd first (works without shell=True)
    if sys.platform == "win32":
        npm_cmd = shutil.which("npm.cmd")
        if npm_cmd:
            return [npm_cmd]

        # Fallback to npm
        npm_cmd = shutil.which("npm")
        if npm_cmd:
            return [npm_cmd]

        # Try common installation paths
        common_paths = [
            r"C:\Program Files\nodejs\npm.cmd",
            r"C:\Program Files (x86)\nodejs\npm.cmd",
        ]
        for path in common_paths:
            if Path(path).exists():
                return [path]
    else:
        # Linux, macOS, Docker - just use npm from PATH
        npm_cmd = shutil.which("npm")
        if npm_cmd:
            return ["npm"]

    raise FileNotFoundError("npm not found in PATH or common locations")


def setup_bpmn_validation() -> None:
    """
    Setup function to ensure bpmnlint dependencies are installed.

    Checks if node_modules directory exists in external/bpmn_lint,
    and runs npm install if it doesn't.

    Raises:
        BPMNValidationError: If setup fails
    """
    try:
        # Get the bpmn_lint directory path
        bpmn_lint_dir = Path(__file__).parent.parent / "external" / "bpmn_lint"

        if not bpmn_lint_dir.exists():
            raise BPMNValidationError(f"bpmn_lint directory not found at {bpmn_lint_dir}")

        # Check if node_modules exists
        node_modules_dir = bpmn_lint_dir / "node_modules"
        package_json = bpmn_lint_dir / "package.json"

        if not package_json.exists():
            raise BPMNValidationError(f"package.json not found at {package_json}")

        # If node_modules doesn't exist, run npm install
        if not node_modules_dir.exists():
            logger.info("Installing bpmnlint dependencies...")
            logger.info(f"Running npm install in {bpmn_lint_dir}")

            # Find npm command
            try:
                npm_cmd = _find_npm_command()
            except FileNotFoundError:
                raise BPMNValidationError("npm not found. Ensure Node.js >= 16 and npm are installed and in PATH.")

            result = subprocess.run(
                npm_cmd + ["install"], cwd=str(bpmn_lint_dir), capture_output=True, text=True, timeout=120
            )

            if result.returncode != 0:
                raise BPMNValidationError(
                    f"npm install failed with exit code {result.returncode}. stderr: {result.stderr}"
                )

            logger.info("bpmnlint dependencies installed successfully")
        else:
            logger.debug("bpmnlint dependencies already installed")

    except subprocess.TimeoutExpired:
        raise BPMNValidationError("npm install timeout (>120s)")
    except BPMNValidationError:
        raise
    except Exception as e:
        raise BPMNValidationError(f"Failed to setup bpmn validation: {str(e)}")


class BPMNValidationService:
    """
    Service for validating BPMN files using bpmnlint.
    """

    def __init__(self, validate_script: Optional[Path] = None):
        """
        Initialize the BPMN validation service.

        Args:
            validate_script: Path to validate.js script. If None, looks in external/bpmn_lint.

        Raises:
            BPMNValidationError: If validate.js is not found.
        """
        if validate_script is None:
            # Try to find validate.js in external/bpmn_lint
            service_script_path = Path(__file__).parent.parent / "external" / "bpmn_lint" / "validate.js"
            validate_script = service_script_path

        self.validate_script = Path(validate_script)

        if not self.validate_script.exists():
            raise BPMNValidationError(
                f"validate.js not found at {self.validate_script}. Ensure external/bpmn_lint is properly set up."
            )

    def validate_file(self, file_path: str, timeout: int = 30) -> ValidationResult:
        """
        Validate a BPMN file.

        Args:
            file_path: Path to the BPMN file
            timeout: Validation timeout in seconds

        Returns:
            BPMNValidationResult with validation results

        Raises:
            BPMNValidationError: If validation fails
        """
        try:
            cmd = ["node", str(self.validate_script), file_path, "--json"]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)

            # Check for errors in stderr or exit code 2 (file not found, invalid args)
            if result.returncode == 2 or "not found" in result.stderr:
                raise BPMNValidationError(f"File not found or invalid arguments: {file_path}")

            # Parse JSON output
            try:
                output: Any = json.loads(result.stdout)
                if isinstance(output, list) and len(output) > 0:
                    output = output[0]

                if not isinstance(output, dict):
                    raise BPMNValidationError(f"Unexpected validation output format: {type(output)}")

                # Check if there's an error in the result (e.g., file not found)
                if isinstance(output.get("error"), str) and output.get("error"):
                    raise BPMNValidationError(f"Validation error: {output['error']}")

                return self._transform_result(output, file_path)
            except json.JSONDecodeError as e:
                raise BPMNValidationError(f"Failed to parse validation output: {e}. stderr: {result.stderr}")

        except subprocess.TimeoutExpired:
            raise BPMNValidationError(f"Validation timeout (>{timeout}s)")
        except FileNotFoundError:
            raise BPMNValidationError("Node.js not found. Ensure Node.js >= 16 is installed.")
        except BPMNValidationError:
            raise
        except Exception as e:
            raise BPMNValidationError(f"Validation failed: {str(e)}")

    @traceable(run_type="tool", name="BPMN Syntax Validation")
    def validate_content(self, bpmn_content: str, filename: str = "model.bpmn", timeout: int = 30) -> ValidationResult:
        """
        Validate BPMN content (XML string).

        Args:
            bpmn_content: BPMN XML content as string
            filename: Name for temporary file
            timeout: Validation timeout in seconds

        Returns:
            BPMNValidationResult with validation results

        Raises:
            BPMNValidationError: If validation fails
        """
        logger.info(f"Starting syntax validation for {filename}")
        # Create temporary file and validate within context
        with tempfile.NamedTemporaryFile(suffix=".bpmn", mode="w", delete=True) as tmp:
            tmp.write(bpmn_content)
            tmp.flush()
            result = self.validate_file(tmp.name, timeout=timeout)
            # Update file path in result to show original filename
            result.file = filename
            logger.info(
                f"Syntax validation completed for {filename}: valid={result.is_valid}, errors={result.error_count}, warnings={result.warning_count}"
            )
            return result

    def _transform_result(self, raw_result: Dict[str, Any], file_path: str) -> ValidationResult:
        """
        Transform raw validation result to BPMNValidationResult schema.

        Args:
            raw_result: Raw result from bpmnlint
            file_path: Path to the validated file

        Returns:
            BPMNValidationResult with transformed data
        """
        # Transform issues to ValidationRule format
        issues: List[ValidationRule] = []
        error_count = 0
        warning_count = 0

        reports = raw_result.get("reports", {})
        if not isinstance(reports, dict):
            reports = {}

        for rule_name, rule_issues in reports.items():
            validation_issues: List[ValidationIssue] = []

            if not isinstance(rule_issues, list):
                continue

            for issue in rule_issues:
                if not isinstance(issue, dict):
                    continue

                category_str = issue.get("category", "error")
                if category_str == "error":
                    error_count += 1
                else:
                    warning_count += 1

                validation_issues.append(
                    ValidationIssue(
                        id=str(issue.get("id", "unknown")),
                        message=str(issue.get("message", "")),
                        category=IssueCategory.ERROR if category_str == "error" else IssueCategory.WARNING,
                    )
                )

            issues.append(
                ValidationRule(
                    rule_name=str(rule_name),
                    issues=validation_issues,
                )
            )

        return ValidationResult(
            file=file_path,
            is_valid=bool(raw_result.get("valid", False)),
            error_count=error_count,
            warning_count=warning_count,
            total_issues=error_count + warning_count,
            issues=issues,
        )
