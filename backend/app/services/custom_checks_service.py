"""Custom BPMN validation checks service."""

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List
import logging

from langsmith import traceable

from app.schemas.custom_checks import (
    CustomChecksResult,
    CustomCheck,
    CustomCheckIssue,
    CustomCheckCategory,
)

logger = logging.getLogger(__name__)


class CustomCheckError(Exception):
    """Custom exception for custom check errors."""

    pass


class ActivityCountCheck:
    """Check for minimum and maximum activity counts in BPMN process."""

    MIN_ACTIVITIES = 6
    MAX_ACTIVITIES = 29

    def execute(self, bpmn_content: str, filename: str = "model.bpmn") -> CustomCheck:
        """
        Check if process has between MIN and MAX activities.

        Args:
            bpmn_content: BPMN XML content as string
            filename: Name for identification

        Returns:
            CustomCheck with results

        Raises:
            CustomCheckError: If check fails to execute
        """
        try:
            root = ET.fromstring(bpmn_content)

            # BPMN namespace
            ns = {"bpmn": "http://www.omg.org/spec/BPMN/20100524/MODEL"}

            # Count all task types (activities)
            activity_count = 0
            activities = []

            # Standard task
            tasks = root.findall(".//bpmn:task", ns)
            activity_count += len(tasks)
            activities.extend([(t.get("id"), t.get("name", "Unnamed")) for t in tasks])

            # Service task
            service_tasks = root.findall(".//bpmn:serviceTask", ns)
            activity_count += len(service_tasks)
            activities.extend([(t.get("id"), t.get("name", "Unnamed")) for t in service_tasks])

            # User task
            user_tasks = root.findall(".//bpmn:userTask", ns)
            activity_count += len(user_tasks)
            activities.extend([(t.get("id"), t.get("name", "Unnamed")) for t in user_tasks])

            # Manual task
            manual_tasks = root.findall(".//bpmn:manualTask", ns)
            activity_count += len(manual_tasks)
            activities.extend([(t.get("id"), t.get("name", "Unnamed")) for t in manual_tasks])

            # Script task
            script_tasks = root.findall(".//bpmn:scriptTask", ns)
            activity_count += len(script_tasks)
            activities.extend([(t.get("id"), t.get("name", "Unnamed")) for t in script_tasks])

            # Business rule task
            business_rule_tasks = root.findall(".//bpmn:businessRuleTask", ns)
            activity_count += len(business_rule_tasks)
            activities.extend([(t.get("id"), t.get("name", "Unnamed")) for t in business_rule_tasks])

            # Send task
            send_tasks = root.findall(".//bpmn:sendTask", ns)
            activity_count += len(send_tasks)
            activities.extend([(t.get("id"), t.get("name", "Unnamed")) for t in send_tasks])

            # Receive task
            receive_tasks = root.findall(".//bpmn:receiveTask", ns)
            activity_count += len(receive_tasks)
            activities.extend([(t.get("id"), t.get("name", "Unnamed")) for t in receive_tasks])

            # Sub-process
            sub_processes = root.findall(".//bpmn:subProcess", ns)
            activity_count += len(sub_processes)
            activities.extend([(t.get("id"), t.get("name", "Unnamed")) for t in sub_processes])

            # Call activity
            call_activities = root.findall(".//bpmn:callActivity", ns)
            activity_count += len(call_activities)
            activities.extend([(t.get("id"), t.get("name", "Unnamed")) for t in call_activities])

            # Build result
            issues: List[CustomCheckIssue] = []
            passed = True

            if activity_count < self.MIN_ACTIVITIES:
                passed = False
                issues.append(
                    CustomCheckIssue(
                        check_id="activity-count-too-low",
                        message=f"Process has {activity_count} activities but minimum is {self.MIN_ACTIVITIES}. "
                        f"Process is too short and may not need to be modeled.",
                        category=CustomCheckCategory.WARNING,
                    )
                )

            if activity_count > self.MAX_ACTIVITIES:
                passed = False
                issues.append(
                    CustomCheckIssue(
                        check_id="activity-count-too-high",
                        message=f"Process has {activity_count} activities but maximum is {self.MAX_ACTIVITIES}. "
                        f"Process is too complex. Consider using sub-processes to reduce complexity.",
                        category=CustomCheckCategory.WARNING,
                    )
                )

            return CustomCheck(
                check_name="Activity Count Validation",
                check_key="activity-count",
                description=f"Verify process has between {self.MIN_ACTIVITIES} and {self.MAX_ACTIVITIES} activities",
                passed=passed,
                issues=issues,
            )

        except ET.ParseError as e:
            raise CustomCheckError(f"Failed to parse BPMN XML: {str(e)}")
        except Exception as e:
            raise CustomCheckError(f"Activity count check failed: {str(e)}")


class GatewayNamingCheck:
    """Check that decision gateways are properly named with questions and outgoing sequences have answers."""

    def execute(self, bpmn_content: str, filename: str = "model.bpmn") -> CustomCheck:
        """
        Check if gateways are named with questions and outgoing sequences have labels.

        Args:
            bpmn_content: BPMN XML content as string
            filename: Name for identification

        Returns:
            CustomCheck with results

        Raises:
            CustomCheckError: If check fails to execute
        """
        try:
            root = ET.fromstring(bpmn_content)

            # BPMN namespace
            ns = {"bpmn": "http://www.omg.org/spec/BPMN/20100524/MODEL"}

            issues: List[CustomCheckIssue] = []
            passed = True

            # Find all exclusive and inclusive gateways
            exclusive_gateways = root.findall(".//bpmn:exclusiveGateway", ns)
            inclusive_gateways = root.findall(".//bpmn:inclusiveGateway", ns)
            all_gateways = exclusive_gateways + inclusive_gateways

            for gateway in all_gateways:
                gateway_id = gateway.get("id", "unknown")
                gateway_name = gateway.get("name", "").strip()
                gateway_type = "Exclusive" if gateway in exclusive_gateways else "Inclusive"

                # Check 1: Gateway name must contain a question mark
                if not gateway_name or "?" not in gateway_name:
                    passed = False
                    issues.append(
                        CustomCheckIssue(
                            check_id="gateway-missing-question",
                            message=f"{gateway_type} Gateway '{gateway_name or 'Unnamed'}' (ID: {gateway_id}) is missing a question mark in its name. "
                            f"Gateway names should be phrased as questions.",
                            category=CustomCheckCategory.ERROR,
                            element_id=gateway_id,
                            element_name=gateway_name,
                        )
                    )

                # Check 2: Verify outgoing sequences have labels (answers)
                outgoing_refs = gateway.findall("bpmn:outgoing", ns)

                if len(outgoing_refs) > 1:  # Only check gateways with multiple outgoing flows
                    for outgoing_ref in outgoing_refs:
                        flow_id = outgoing_ref.text
                        if not flow_id:
                            continue

                        # Find the corresponding sequence flow
                        sequence_flow = root.find(f".//bpmn:sequenceFlow[@id='{flow_id}']", ns)
                        if sequence_flow is not None:
                            flow_name = sequence_flow.get("name", "").strip()

                            # Check if sequence flow has a label
                            if not flow_name:
                                passed = False
                                issues.append(
                                    CustomCheckIssue(
                                        check_id="outgoing-sequence-missing-label",
                                        message=f"Outgoing sequence flow from {gateway_type} Gateway '{gateway_name}' (ID: {gateway_id}) "
                                        f"is missing a label. Each answer/option should be clearly labeled.",
                                        category=CustomCheckCategory.WARNING,
                                        element_id=flow_id,
                                        element_name="Outgoing Flow",
                                    )
                                )

            return CustomCheck(
                check_name="Gateway Naming Validation",
                check_key="gateway-naming",
                description="Verify decision gateways are named as questions and outgoing sequences have answer labels",
                passed=passed,
                issues=issues,
            )

        except ET.ParseError as e:
            raise CustomCheckError(f"Failed to parse BPMN XML: {str(e)}")
        except Exception as e:
            raise CustomCheckError(f"Gateway naming check failed: {str(e)}")


class TaskNameLengthCheck:
    """Check that task names fit within standard BPMN activity element dimensions."""

    # Standard BPMN task element is ~100x80 pixels
    # This typically allows for ~25-30 characters per line with standard font
    MAX_NAME_LENGTH = 50  # Maximum single-line length
    MAX_TOTAL_LENGTH = 100  # Maximum total length (considering line breaks)
    RECOMMENDED_LENGTH = 30  # Recommended length to fit without resizing

    def execute(self, bpmn_content: str, filename: str = "model.bpmn") -> CustomCheck:
        """
        Check if task names fit within standard activity element size.

        Args:
            bpmn_content: BPMN XML content as string
            filename: Name for identification

        Returns:
            CustomCheck with results

        Raises:
            CustomCheckError: If check fails to execute
        """
        try:
            root = ET.fromstring(bpmn_content)

            # BPMN namespace
            ns = {"bpmn": "http://www.omg.org/spec/BPMN/20100524/MODEL"}

            issues: List[CustomCheckIssue] = []
            passed = True

            # Find all task types
            task_types = [
                "task",
                "serviceTask",
                "userTask",
                "manualTask",
                "scriptTask",
                "businessRuleTask",
                "sendTask",
                "receiveTask",
                "subProcess",
                "callActivity",
            ]

            all_tasks = []
            for task_type in task_types:
                tasks = root.findall(f".//bpmn:{task_type}", ns)
                all_tasks.extend(tasks)

            for task in all_tasks:
                task_id = task.get("id", "unknown")
                task_name = task.get("name", "").strip()

                if not task_name:
                    continue  # Skip unnamed tasks (handled by label-required rule)

                # Check total length
                if len(task_name) > self.MAX_TOTAL_LENGTH:
                    passed = False
                    issues.append(
                        CustomCheckIssue(
                            check_id="task-name-too-long",
                            message=f"Task '{task_name}' (ID: {task_id}) has {len(task_name)} characters, exceeding maximum of {self.MAX_TOTAL_LENGTH}. "
                            f"The element will need to be resized. Consider shortening the name or using abbreviations.",
                            category=CustomCheckCategory.ERROR,
                            element_id=task_id,
                            element_name=task_name,
                        )
                    )
                # Check if single line exceeds recommended length
                elif len(task_name) > self.RECOMMENDED_LENGTH:
                    passed = False
                    issues.append(
                        CustomCheckIssue(
                            check_id="task-name-long",
                            message=f"Task '{task_name}' (ID: {task_id}) has {len(task_name)} characters. "
                            f"Recommended maximum is {self.RECOMMENDED_LENGTH} characters to fit in standard element size without line breaks. "
                            f"Consider shortening the name.",
                            category=CustomCheckCategory.WARNING,
                            element_id=task_id,
                            element_name=task_name,
                        )
                    )

            return CustomCheck(
                check_name="Task Name Length Validation",
                check_key="task-name-length",
                description=f"Verify task names fit within standard activity element size (max {self.MAX_TOTAL_LENGTH} chars, recommended {self.RECOMMENDED_LENGTH})",
                passed=passed,
                issues=issues,
            )

        except ET.ParseError as e:
            raise CustomCheckError(f"Failed to parse BPMN XML: {str(e)}")
        except Exception as e:
            raise CustomCheckError(f"Task name length check failed: {str(e)}")


class CustomChecksService:
    """Service for running custom BPMN validation checks."""

    def __init__(self):
        """Initialize the custom checks service."""
        self.checks = {
            "activity-count": ActivityCountCheck(),
            "gateway-naming": GatewayNamingCheck(),
            "task-name-length": TaskNameLengthCheck(),
            # More checks can be added here in the future
        }

    def validate_file(self, file_path: str) -> CustomChecksResult:
        """
        Run custom checks on a BPMN file.

        Args:
            file_path: Path to the BPMN file

        Returns:
            BPMNCustomChecksResult with check results

        Raises:
            CustomCheckError: If validation fails
        """
        try:
            path = Path(file_path)
            if not path.exists():
                raise CustomCheckError(f"File not found: {file_path}")

            if path.suffix.lower() != ".bpmn":
                raise CustomCheckError("Invalid file type: Expected a .bpmn file")

            content = path.read_text(encoding="utf-8")
            return self.validate_content(content, filename=str(path))

        except CustomCheckError:
            raise
        except Exception as e:
            raise CustomCheckError(f"Failed to run custom checks: {str(e)}")

    @traceable(run_type="tool", name="Custom Rules Validation")
    def validate_content(self, bpmn_content: str, filename: str = "model.bpmn") -> CustomChecksResult:
        """
        Run custom checks on BPMN content (XML string).

        Args:
            bpmn_content: BPMN XML content as string
            filename: Name for identification

        Returns:
            BPMNCustomChecksResult with check results

        Raises:
            CustomCheckError: If validation fails
        """
        logger.info(f"Starting custom checks for {filename}")
        try:
            results: List[CustomCheck] = []
            error_count = 0
            warning_count = 0
            info_count = 0

            # Run each check
            for check_key, check_instance in self.checks.items():
                try:
                    check_result = check_instance.execute(bpmn_content, filename)
                    results.append(check_result)

                    # Count issues by category
                    for issue in check_result.issues:
                        if issue.category == CustomCheckCategory.ERROR:
                            error_count += 1
                        elif issue.category == CustomCheckCategory.WARNING:
                            warning_count += 1
                        elif issue.category == CustomCheckCategory.INFO:
                            info_count += 1

                except Exception as e:
                    logger.error(f"Error running check {check_key}: {str(e)}")
                    # Continue with other checks even if one fails
                    continue

            # Count passed/failed checks
            checks_passed = sum(1 for check in results if check.passed)
            checks_failed = len(results) - checks_passed

            logger.info(f"Custom checks completed for {filename}: passed={checks_passed}, failed={checks_failed}")
            return CustomChecksResult(
                file=filename,
                checks_passed=checks_passed,
                checks_failed=checks_failed,
                total_checks=len(results),
                error_count=error_count,
                warning_count=warning_count,
                info_count=info_count,
                total_issues=error_count + warning_count + info_count,
                checks=results,
            )

        except CustomCheckError:
            raise
        except Exception as e:
            raise CustomCheckError(f"Custom checks validation failed: {str(e)}")
