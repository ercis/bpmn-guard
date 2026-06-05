"""KPI Service for aggregating dashboard metrics."""

import logging
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from langsmith import traceable
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.evaluation_report import EvaluationReport as EvaluationReportDB
from app.language_model_client.client import LLMClient
from app.schemas.kpi import (
    ComplexityMetrics,
    CustomRulesMetrics,
    KPIResponse,
    RatingDistribution,
    RecentReport,
    ReportTrend,
    SemanticLabelMetrics,
    SyntaxMetrics,
    ViolationDistribution,
)

logger = logging.getLogger(__name__)


class KPIService:
    """Service for calculating KPI metrics."""

    # CFC thresholds for complexity level classification
    CFC_LOW_THRESHOLD = 5
    CFC_HIGH_THRESHOLD = 10

    # Semantic label rule descriptions for LLM context
    SEMANTIC_RULE_DESCRIPTIONS: dict[str, str] = {
        "R1": "Activity names must use verb + object pattern (e.g., 'Send invoice' not 'Handle invoice')",
        "R2": "Event names must describe business result/state (e.g., 'Order shipped' not 'Order processed')",
        "R3": "Gateway names must use question format (e.g., 'Is invoice complete?')",
        "R4": "Names should be short and action-oriented (≤4 words)",
        "R5": "Use consistent naming style, avoid unnecessary synonyms",
        "R6": "Only name elements that require business meaning, avoid redundant text",
        "R7": "Use sentence case (capitalize only first word and proper nouns)",
        "R8": "Avoid technical jargon or system names unless they have business meaning",
        "R9": "Avoid or define abbreviations",
    }

    @staticmethod
    async def get_kpis(db: AsyncSession, user_id: UUID | None = None) -> KPIResponse:
        """
        Get KPI metrics, optionally filtered by user.

        Args:
            db: Async database session
            user_id: Optional user UUID to filter reports by uploaded_by field

        Returns:
            KPIResponse with all dashboard metrics
        """
        if user_id:
            logger.info("Calculating KPI metrics for user %s", user_id)
        else:
            logger.info("Calculating KPI metrics for all users")
        return await KPIService._calculate_kpis(db, user_id=user_id)

    @staticmethod
    async def _calculate_kpis(db: AsyncSession, user_id: UUID | None = None) -> KPIResponse:
        """
        Calculate all KPI metrics from the database.

        Args:
            db: Async database session
            user_id: Optional user UUID to filter reports by uploaded_by field

        Returns:
            KPIResponse with fresh calculated metrics
        """
        # Build query with optional user filter
        query = select(EvaluationReportDB).order_by(EvaluationReportDB.created_at.desc())
        if user_id:
            query = query.where(EvaluationReportDB.uploaded_by == user_id)

        result = await db.execute(query)
        reports = list(result.scalars().all())

        total_reports = len(reports)

        if total_reports == 0:
            return KPIService._empty_response()

        # Calculate all metrics
        syntax_metrics = KPIService._aggregate_syntax_metrics(reports)
        complexity_metrics = KPIService._aggregate_complexity_metrics(reports)
        semantic_metrics = KPIService._aggregate_semantic_metrics(reports)
        custom_rules_metrics = KPIService._aggregate_custom_rules_metrics(reports)

        # Calculate averages and distributions
        avg_rating = KPIService._calculate_avg_rating(reports)
        rating_distribution = KPIService._build_rating_distribution(reports)
        report_trends = KPIService._build_report_trends(reports)
        violation_distribution = KPIService._build_violation_distribution(reports)

        # Calculate top-level KPI card values
        complexity_level = KPIService._get_most_common_complexity_level(reports)
        most_common_violation = KPIService._get_most_common_violation(violation_distribution)
        duplicate_risk = KPIService._calculate_duplicate_risk(reports)

        # Get recent reports
        recent_reports = KPIService._get_recent_reports(reports[:5])

        # Generate learning suggestions only for user-specific views
        learning_suggestions = None
        if user_id:
            # Extract violation rule frequencies for better LLM context
            violation_rules = KPIService._extract_violation_rules(reports)
            learning_suggestions = await KPIService._generate_learning_suggestions(
                total_reports=total_reports,
                avg_rating=avg_rating,
                syntax_metrics=syntax_metrics,
                complexity_metrics=complexity_metrics,
                semantic_metrics=semantic_metrics,
                custom_rules_metrics=custom_rules_metrics,
                most_common_violation=most_common_violation,
                violation_distribution=violation_distribution,
                violation_rules=violation_rules,
            )

        return KPIResponse(
            total_reports=total_reports,
            learning_suggestions=learning_suggestions,
            avg_evaluation_rating=avg_rating,
            complexity_level=complexity_level,
            avg_cfc_score=complexity_metrics.avg_cfc_score if complexity_metrics.avg_cfc_score > 0 else None,
            most_common_violation=most_common_violation,
            duplicate_risk_percentage=duplicate_risk,
            syntax_metrics=syntax_metrics,
            complexity_metrics=complexity_metrics,
            semantic_label_metrics=semantic_metrics,
            custom_rules_metrics=custom_rules_metrics,
            violation_distribution=violation_distribution,
            rating_distribution=rating_distribution,
            report_trends=report_trends,
            recent_reports=recent_reports,
            cached_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def _empty_response() -> KPIResponse:
        """Return an empty KPI response when no reports exist."""
        return KPIResponse(
            total_reports=0,
            avg_evaluation_rating=None,
            complexity_level="N/A",
            avg_cfc_score=None,
            most_common_violation="None",
            duplicate_risk_percentage=0.0,
            syntax_metrics=SyntaxMetrics(
                total_errors=0, total_warnings=0, avg_errors_per_report=0.0, avg_warnings_per_report=0.0
            ),
            complexity_metrics=ComplexityMetrics(avg_cfc_score=0.0, avg_cw_score=0.0),
            semantic_label_metrics=SemanticLabelMetrics(avg_rating=0.0),
            custom_rules_metrics=CustomRulesMetrics(total_checks=0, total_passed=0, total_failed=0, pass_rate=0.0),
            violation_distribution=[],
            rating_distribution=[],
            report_trends=[],
            recent_reports=[],
            cached_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def _extract_violation_rules(
        reports: list[EvaluationReportDB],
    ) -> dict[str, list[tuple[str, int]]]:
        """
        Extract violation rule frequencies from reports.

        Args:
            reports: List of evaluation reports

        Returns:
            Dict with keys 'semantic', 'syntax', 'custom' each containing
            a list of (rule_name, count) tuples sorted by count descending
        """
        semantic_rules: Counter[str] = Counter()
        syntax_rules: Counter[str] = Counter()
        custom_rules: Counter[str] = Counter()

        for report in reports:
            # Semantic violations - count by rule_id
            if report.semantic_label_check_result:
                violations = report.semantic_label_check_result.get("violations", [])
                for violation in violations:
                    rule_id = violation.get("rule_id")
                    if rule_id:
                        semantic_rules[rule_id] += 1

            # Syntax violations - count by rule_name
            if report.syntax_check_result:
                issues = report.syntax_check_result.get("issues", [])
                for rule in issues:
                    rule_name = rule.get("rule_name")
                    if rule_name:
                        # Count each issue under this rule
                        rule_issues = rule.get("issues", [])
                        syntax_rules[rule_name] += len(rule_issues)

            # Custom rule failures - count by check_name
            if report.custom_rules_check_result:
                checks = report.custom_rules_check_result.get("checks", [])
                for check in checks:
                    if not check.get("passed", True):
                        check_name = check.get("check_name")
                        if check_name:
                            custom_rules[check_name] += 1

        return {
            "semantic": semantic_rules.most_common(5),
            "syntax": syntax_rules.most_common(5),
            "custom": custom_rules.most_common(5),
        }

    @staticmethod
    @traceable(run_type="llm", name="Generate Learning Suggestions")
    async def _generate_learning_suggestions(
        *,
        total_reports: int,
        avg_rating: float | None,
        syntax_metrics: SyntaxMetrics,
        complexity_metrics: ComplexityMetrics,
        semantic_metrics: SemanticLabelMetrics,
        custom_rules_metrics: CustomRulesMetrics,
        most_common_violation: str,
        violation_distribution: list[ViolationDistribution],
        violation_rules: dict[str, list[tuple[str, int]]],
    ) -> str | None:
        """
        Generate LLM-based personalized learning suggestions based on user's aggregated metrics.

        Args:
            total_reports: Total number of reports for this user
            avg_rating: Average evaluation rating
            syntax_metrics: Aggregated syntax metrics
            complexity_metrics: Aggregated complexity metrics
            semantic_metrics: Aggregated semantic label metrics
            custom_rules_metrics: Aggregated custom rules metrics
            most_common_violation: Most common violation category
            violation_distribution: Violations by category
            violation_rules: Specific rule violations with counts

        Returns:
            LLM-generated learning suggestions string, or None if generation fails
        """
        if total_reports == 0:
            return None

        try:
            llm_client = LLMClient(temperature=0.7, max_tokens=500).create_llm_model()

            # Build violation rules summary with descriptions for semantic rules
            def format_semantic_rules(rules: list[tuple[str, int]]) -> str:
                if not rules:
                    return "None"
                formatted = []
                for rule_id, count in rules:
                    desc = KPIService.SEMANTIC_RULE_DESCRIPTIONS.get(rule_id, "Unknown rule")
                    formatted.append(f"{rule_id} ({count}x): {desc}")
                return "\n  - ".join([""] + formatted)  # Starts with newline for proper formatting

            def format_rules(rules: list[tuple[str, int]]) -> str:
                if not rules:
                    return "None"
                return ", ".join(f'"{name}" ({count}x)' for name, count in rules)

            semantic_rules_str = format_semantic_rules(violation_rules.get("semantic", []))
            syntax_rules_str = format_rules(violation_rules.get("syntax", []))
            custom_rules_str = format_rules(violation_rules.get("custom", []))

            prompt = f"""You are a BPMN modeling coach providing personalized learning opportunities.

Based on the user's evaluation history, identify 2-3 key improvement areas with actionable steps.

User's Metrics:
- Models evaluated: {total_reports} | Avg rating: {avg_rating if avg_rating else "N/A"}/10
- Syntax: {syntax_metrics.total_errors} errors, {syntax_metrics.total_warnings} warnings
- Complexity: CFC {complexity_metrics.avg_cfc_score:.1f}, CW {complexity_metrics.avg_cw_score:.1f}
- Semantic labels: {semantic_metrics.avg_rating:.0f}/100
- Custom rules: {custom_rules_metrics.pass_rate:.0f}% pass rate

Specific Violated Rules (by frequency):
- Semantic rule violations: {semantic_rules_str}
- Syntax rule violations: {syntax_rules_str}
- Custom rule failures: {custom_rules_str}

Guidelines:
- Focus on the most frequently violated rules
- Explain what each violated rule means and why it matters
- Provide concrete steps to fix these specific issues
- Be concise but educational

Format rules (STRICT):
- NO headings (no #, ##, ###)
- Use a bullet list with **bold** for each improvement area name
- Under each area, use a nested list for "Why" and "How to improve"
- Keep each point to 1 sentence max
- Total response under 200 words

Example format:
- **Semantic Labeling**: Your labels lack clarity
  - *Why*: Ambiguous labels make processes harder to understand
  - *How*: Use verb-object format like "Validate Order" instead of "Processing"
- **Complexity**: High gateway nesting detected
  - *Why*: Deep nesting increases errors and maintenance cost
  - *How*: Extract complex branches into subprocesses"""

            response = await llm_client.ainvoke(prompt)
            content = response.content
            if isinstance(content, str) and content.strip():
                return content.strip()
            return None
        except Exception:
            logger.exception("Failed to generate learning suggestions")
            return None

    @staticmethod
    def _aggregate_syntax_metrics(reports: list[EvaluationReportDB]) -> SyntaxMetrics:
        """Aggregate syntax check metrics across all reports."""
        total_errors = 0
        total_warnings = 0
        reports_with_syntax = 0

        for report in reports:
            if report.syntax_check_result:
                reports_with_syntax += 1
                total_errors += report.syntax_check_result.get("error_count", 0)
                total_warnings += report.syntax_check_result.get("warning_count", 0)

        avg_errors = total_errors / reports_with_syntax if reports_with_syntax > 0 else 0.0
        avg_warnings = total_warnings / reports_with_syntax if reports_with_syntax > 0 else 0.0

        return SyntaxMetrics(
            total_errors=total_errors,
            total_warnings=total_warnings,
            avg_errors_per_report=round(avg_errors, 2),
            avg_warnings_per_report=round(avg_warnings, 2),
        )

    @staticmethod
    def _aggregate_complexity_metrics(reports: list[EvaluationReportDB]) -> ComplexityMetrics:
        """Aggregate complexity metrics across all reports."""
        cfc_scores: list[float] = []
        cw_scores: list[float] = []

        for report in reports:
            if report.complexity_check_result:
                cfc = report.complexity_check_result.get("cfc_score")
                cw = report.complexity_check_result.get("cw_score")
                if cfc is not None:
                    cfc_scores.append(float(cfc))
                if cw is not None:
                    cw_scores.append(float(cw))

        avg_cfc = sum(cfc_scores) / len(cfc_scores) if cfc_scores else 0.0
        avg_cw = sum(cw_scores) / len(cw_scores) if cw_scores else 0.0

        return ComplexityMetrics(avg_cfc_score=round(avg_cfc, 2), avg_cw_score=round(avg_cw, 2))

    @staticmethod
    def _aggregate_semantic_metrics(reports: list[EvaluationReportDB]) -> SemanticLabelMetrics:
        """Aggregate semantic label check metrics across all reports."""
        ratings: list[float] = []

        for report in reports:
            if report.semantic_label_check_result:
                rating = report.semantic_label_check_result.get("rating")
                if rating is not None:
                    ratings.append(float(rating))

        avg_rating = sum(ratings) / len(ratings) if ratings else 0.0

        return SemanticLabelMetrics(avg_rating=round(avg_rating, 2))

    @staticmethod
    def _aggregate_custom_rules_metrics(reports: list[EvaluationReportDB]) -> CustomRulesMetrics:
        """Aggregate custom rules check metrics across all reports."""
        total_checks = 0
        total_passed = 0
        total_failed = 0

        for report in reports:
            if report.custom_rules_check_result:
                checks = report.custom_rules_check_result.get("checks", [])
                for check in checks:
                    total_checks += 1
                    if check.get("passed", False):
                        total_passed += 1
                    else:
                        total_failed += 1

        pass_rate = (total_passed / total_checks * 100) if total_checks > 0 else 0.0

        return CustomRulesMetrics(
            total_checks=total_checks,
            total_passed=total_passed,
            total_failed=total_failed,
            pass_rate=round(pass_rate, 2),
        )

    @staticmethod
    def _calculate_avg_rating(reports: list[EvaluationReportDB]) -> float | None:
        """Calculate average evaluation rating."""
        ratings = [r.evaluation_rating for r in reports if r.evaluation_rating is not None]
        if not ratings:
            return None
        return round(sum(ratings) / len(ratings), 2)

    @staticmethod
    def _build_rating_distribution(reports: list[EvaluationReportDB]) -> list[RatingDistribution]:
        """Build rating distribution for bar chart."""
        counter: Counter[int] = Counter()
        for report in reports:
            if report.evaluation_rating is not None:
                counter[report.evaluation_rating] += 1

        # Return all ratings 1-10, even if count is 0
        return [RatingDistribution(rating=i, count=counter.get(i, 0)) for i in range(1, 11)]

    @staticmethod
    def _build_report_trends(reports: list[EvaluationReportDB]) -> list[ReportTrend]:
        """Build report trends for the last 30 days."""
        today = datetime.now(timezone.utc).date()
        start_date = today - timedelta(days=29)

        # Group reports by date
        date_data: dict[str, dict[str, Any]] = {}
        for i in range(30):
            date = start_date + timedelta(days=i)
            date_str = date.strftime("%Y-%m-%d")
            date_data[date_str] = {"count": 0, "ratings": []}

        for report in reports:
            # Handle both timezone-aware and naive datetimes
            created_at = report.created_at
            if created_at.tzinfo is not None:
                created_at = created_at.replace(tzinfo=None)
            report_date = created_at.date()
            if start_date <= report_date <= today:
                date_str = report_date.strftime("%Y-%m-%d")
                if date_str in date_data:
                    date_data[date_str]["count"] += 1
                    if report.evaluation_rating is not None:
                        date_data[date_str]["ratings"].append(report.evaluation_rating)

        # Build trend list
        trends: list[ReportTrend] = []
        for date_str in sorted(date_data.keys()):
            data = date_data[date_str]
            avg_rating = None
            if data["ratings"]:
                avg_rating = round(sum(data["ratings"]) / len(data["ratings"]), 2)
            trends.append(ReportTrend(date=date_str, count=data["count"], avg_rating=avg_rating))

        return trends

    @staticmethod
    def _build_violation_distribution(reports: list[EvaluationReportDB]) -> list[ViolationDistribution]:
        """Build violation distribution by category."""
        syntax_count = 0
        semantic_count = 0
        custom_count = 0
        duplicate_count = 0

        for report in reports:
            # Syntax violations (errors + warnings)
            if report.syntax_check_result:
                syntax_count += report.syntax_check_result.get("error_count", 0)
                syntax_count += report.syntax_check_result.get("warning_count", 0)

            # Semantic violations
            if report.semantic_label_check_result:
                violations = report.semantic_label_check_result.get("violations", [])
                semantic_count += len(violations)

            # Custom rules violations
            if report.custom_rules_check_result:
                checks = report.custom_rules_check_result.get("checks", [])
                for check in checks:
                    if not check.get("passed", True):
                        custom_count += 1

            # Duplicate violations (models with >90% similarity)
            if report.duplicate_check_result:
                similar_models = report.duplicate_check_result.get("similar_models", [])
                for model in similar_models:
                    if model.get("rating", 0) >= 9:  # Rating 9+ indicates >90% similarity
                        duplicate_count += 1
                        break  # Count only once per report

        return [
            ViolationDistribution(category="Syntax", count=syntax_count),
            ViolationDistribution(category="Semantics", count=semantic_count),
            ViolationDistribution(category="Custom Rules", count=custom_count),
            ViolationDistribution(category="Duplicates", count=duplicate_count),
        ]

    @staticmethod
    def _get_most_common_complexity_level(reports: list[EvaluationReportDB]) -> str:
        """Determine the most common complexity level."""
        levels: Counter[str] = Counter()

        for report in reports:
            if report.complexity_check_result:
                cfc = report.complexity_check_result.get("cfc_score", 0)
                level = KPIService._cfc_to_complexity_level(cfc)
                levels[level] += 1

        if not levels:
            return "N/A"

        return levels.most_common(1)[0][0]

    @staticmethod
    def _cfc_to_complexity_level(cfc_score: float) -> str:
        """Convert CFC score to complexity level."""
        if cfc_score < KPIService.CFC_LOW_THRESHOLD:
            return "Low"
        elif cfc_score < KPIService.CFC_HIGH_THRESHOLD:
            return "Med"
        else:
            return "High"

    @staticmethod
    def _get_most_common_violation(violation_dist: list[ViolationDistribution]) -> str:
        """Get the category with most violations."""
        if not violation_dist:
            return "None"

        max_violation = max(violation_dist, key=lambda v: v.count)
        if max_violation.count == 0:
            return "None"

        return max_violation.category

    @staticmethod
    def _calculate_duplicate_risk(reports: list[EvaluationReportDB]) -> float:
        """Calculate percentage of reports with high duplicate risk (>90% similarity)."""
        if not reports:
            return 0.0

        high_risk_count = 0
        for report in reports:
            if report.duplicate_check_result:
                similar_models = report.duplicate_check_result.get("similar_models", [])
                for model in similar_models:
                    if model.get("rating", 0) >= 9:  # Rating 9+ indicates >90% similarity
                        high_risk_count += 1
                        break

        return round((high_risk_count / len(reports)) * 100, 2)

    @staticmethod
    def _get_recent_reports(reports: list[EvaluationReportDB]) -> list[RecentReport]:
        """Convert recent DB reports to RecentReport schema."""
        recent: list[RecentReport] = []

        for report in reports:
            # Extract filename from path
            file_name = report.file_path.split("/")[-1].split("\\")[-1]

            # Determine complexity level
            cfc_score = None
            complexity_level = "N/A"
            if report.complexity_check_result:
                cfc_score = report.complexity_check_result.get("cfc_score")
                if cfc_score is not None:
                    complexity_level = KPIService._cfc_to_complexity_level(float(cfc_score))

            recent.append(
                RecentReport(
                    id=str(report.id),
                    model_id=str(report.model_id),
                    file_path=report.file_path,
                    file_name=file_name,
                    evaluation_rating=report.evaluation_rating,
                    complexity_level=complexity_level,
                    cfc_score=float(cfc_score) if cfc_score is not None else None,
                    created_at=report.created_at,
                )
            )

        return recent
