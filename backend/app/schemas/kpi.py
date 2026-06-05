"""KPI Dashboard schemas for aggregated metrics."""

from datetime import datetime

from pydantic import BaseModel, Field


class RatingDistribution(BaseModel):
    """Distribution of ratings for the bar chart."""

    rating: int = Field(ge=1, le=10, description="Rating value (1-10)")
    count: int = Field(ge=0, description="Number of reports with this rating")


class ReportTrend(BaseModel):
    """Daily report trend data for line chart."""

    date: str = Field(description="Date in YYYY-MM-DD format")
    count: int = Field(ge=0, description="Number of reports on this date")
    avg_rating: float | None = Field(default=None, description="Average rating on this date")


class SyntaxMetrics(BaseModel):
    """Aggregated syntax check metrics."""

    total_errors: int = Field(ge=0, description="Total syntax errors across all reports")
    total_warnings: int = Field(ge=0, description="Total syntax warnings across all reports")
    avg_errors_per_report: float = Field(ge=0, description="Average errors per report")
    avg_warnings_per_report: float = Field(ge=0, description="Average warnings per report")


class ComplexityMetrics(BaseModel):
    """Aggregated complexity metrics."""

    avg_cfc_score: float = Field(ge=0, description="Average Control Flow Complexity score")
    avg_cw_score: float = Field(ge=0, description="Average Cognitive Weight score")


class SemanticLabelMetrics(BaseModel):
    """Aggregated semantic label check metrics."""

    avg_rating: float = Field(ge=0, le=100, description="Average semantic label rating (0-100)")


class CustomRulesMetrics(BaseModel):
    """Aggregated custom rules check metrics."""

    total_checks: int = Field(ge=0, description="Total custom rule checks performed")
    total_passed: int = Field(ge=0, description="Total checks that passed")
    total_failed: int = Field(ge=0, description="Total checks that failed")
    pass_rate: float = Field(ge=0, le=100, description="Pass rate percentage")


class ViolationDistribution(BaseModel):
    """Violation counts by category for bar chart."""

    category: str = Field(description="Category: Syntax, Semantics, Custom Rules, or Duplicates")
    count: int = Field(ge=0, description="Number of violations in this category")


class RecentReport(BaseModel):
    """Recent report summary for the table."""

    id: str = Field(description="Report UUID")
    model_id: str = Field(description="Associated BPMN model UUID")
    file_path: str = Field(description="Full file path")
    file_name: str = Field(description="Extracted file name from path")
    evaluation_rating: int | None = Field(default=None, ge=1, le=10, description="Overall rating (1-10)")
    complexity_level: str = Field(description="Complexity level: Low, Med, or High")
    cfc_score: float | None = Field(default=None, ge=0, description="Control Flow Complexity score")
    created_at: datetime = Field(description="Report creation timestamp")


class KPIResponse(BaseModel):
    """Complete KPI dashboard response with all metrics and chart data."""

    # Summary metrics
    total_reports: int = Field(ge=0, description="Total number of evaluation reports")

    # Learning suggestions (only populated for user-specific views)
    learning_suggestions: str | None = Field(
        default=None,
        description="LLM-generated personalized feedback for improvement areas. Only populated for user-specific views.",
    )
    avg_evaluation_rating: float | None = Field(
        default=None, description="Average evaluation rating across all reports"
    )

    # Top-level KPI card data
    complexity_level: str = Field(description="Most common complexity level: Low, Med, or High")
    avg_cfc_score: float | None = Field(default=None, description="Average CFC score")
    most_common_violation: str = Field(description="Most common violation category")
    duplicate_risk_percentage: float = Field(ge=0, le=100, description="Percentage of models with >90% similarity")

    # Detailed metrics
    syntax_metrics: SyntaxMetrics = Field(description="Aggregated syntax check metrics")
    complexity_metrics: ComplexityMetrics = Field(description="Aggregated complexity metrics")
    semantic_label_metrics: SemanticLabelMetrics = Field(description="Aggregated semantic label metrics")
    custom_rules_metrics: CustomRulesMetrics = Field(description="Aggregated custom rules metrics")

    # Chart data
    violation_distribution: list[ViolationDistribution] = Field(description="Violations by category for bar chart")
    rating_distribution: list[RatingDistribution] = Field(description="Rating distribution for bar chart")
    report_trends: list[ReportTrend] = Field(description="Report trends for last 30 days line chart")

    # Recent reports for table
    recent_reports: list[RecentReport] = Field(description="Last 5 recent reports")

    # Cache metadata
    cached_at: datetime = Field(description="Timestamp when this data was cached")
