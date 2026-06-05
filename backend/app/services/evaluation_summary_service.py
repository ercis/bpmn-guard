from __future__ import annotations

import logging

from langchain_core.language_models import BaseChatModel
from langsmith import traceable

from app.schemas.evaluation import ModelEvaluation
from app.schemas.validation import ValidationResult
from app.schemas.custom_checks import CustomChecksResult
from app.schemas.complexity_check import ComplexityCheckResult
from app.schemas.semantic_label_check_schemas import SemanticLabelCheckResult
from app.schemas.duplicate_check import DuplicateCheckResult

logger = logging.getLogger(__name__)


class _EvaluationWeights:
    """Fixed weights for weighted average overall rating.

    Weights sum to 1.0 for proper averaging.
    """

    SYNTAX: float = 0.30  # Critical - model validity
    CUSTOM_RULES: float = 0.25  # Important - business rules
    SEMANTIC: float = 0.20  # Quality - readability
    COMPLEXITY: float = 0.15  # Advisory - maintainability
    DUPLICATE: float = 0.10  # Informational - governance


# Default score when a check result is missing (neutral score)
_MISSING_CHECK_DEFAULT_SCORE = 5.0


class EvaluationSummaryService:
    """Create a weighted average overall rating and LLM-generated summary from all checks."""

    @staticmethod
    def _score_syntax(syntax_check: ValidationResult | None) -> tuple[float, str]:
        """Score syntax check results (0-10 scale)."""
        if syntax_check is None:
            return _MISSING_CHECK_DEFAULT_SCORE, "Syntax check: missing result"

        if syntax_check.error_count > 0:
            # Scale: 0 errors = 10, 5+ errors = 0
            score = max(0.0, 10.0 - syntax_check.error_count * 2)
            return score, f"Syntax check: {syntax_check.error_count} errors"

        if syntax_check.warning_count > 0:
            # Warnings are minor: 1 warning = 9, 10+ warnings = 5
            score = max(5.0, 10.0 - syntax_check.warning_count * 0.5)
            return score, f"Syntax check: {syntax_check.warning_count} warnings"

        return 10.0, "Syntax check: passed"

    @staticmethod
    def _score_custom_rules(custom_check: CustomChecksResult | None) -> tuple[float, str]:
        """Score custom rules check results (0-10 scale)."""
        if custom_check is None:
            return _MISSING_CHECK_DEFAULT_SCORE, "Custom rules: missing result"

        if custom_check.error_count > 0:
            score = max(0.0, 10.0 - custom_check.error_count * 2)
            return score, f"Custom rules: {custom_check.error_count} errors"

        if custom_check.warning_count > 0:
            score = max(5.0, 10.0 - custom_check.warning_count * 0.5)
            return score, f"Custom rules: {custom_check.warning_count} warnings"

        return 10.0, "Custom rules: passed"

    @staticmethod
    def _score_complexity(complexity_check: ComplexityCheckResult | None) -> tuple[float, str]:
        """Score complexity check results (0-10 scale)."""
        if complexity_check is None:
            return _MISSING_CHECK_DEFAULT_SCORE, "Complexity: missing result"

        cw = complexity_check.cw_score
        cfc = complexity_check.cfc_score

        # CW scoring (continuous): 0-10 = 10, then linear decay to 2 at CW=50
        if cw <= 10:
            cw_score = 10.0
        else:
            # Linear decay: 10 at CW=10, 2 at CW=50
            cw_score = max(2.0, 10.0 - (cw - 10) * 0.2)

        # CFC scoring (continuous): 0-5 = 10, then linear decay to 3 at CFC=19
        if cfc <= 5:
            cfc_score = 10.0
        else:
            # Linear decay: 10 at CFC=5, 3 at CFC=19
            cfc_score = max(3.0, 10.0 - (cfc - 5) * 0.5)

        score = (cw_score + cfc_score) / 2
        return score, f"Complexity: CW={cw}, CFC={cfc}"

    @staticmethod
    def _score_semantic(semantic_check: SemanticLabelCheckResult | None) -> tuple[float, str]:
        """Score semantic label check results (0-10 scale)."""
        if semantic_check is None:
            return _MISSING_CHECK_DEFAULT_SCORE, "Semantic labels: missing result"

        # Direct mapping: 0-100 → 0-10
        score = semantic_check.rating / 10.0
        return score, f"Semantic labels: {semantic_check.rating}/100"

    @staticmethod
    def _score_duplicate(duplicate_check: DuplicateCheckResult | None) -> tuple[float, str]:
        """Score duplicate check results (0-10 scale)."""
        if duplicate_check is None:
            return _MISSING_CHECK_DEFAULT_SCORE, "Duplicate check: missing result"

        if not duplicate_check.similar_models:
            return 10.0, "Duplicate check: no duplicates found"

        # Find the most similar model (highest similarity = worst case)
        most_similar = max(duplicate_check.similar_models, key=lambda m: m.rating)
        # High similarity = lower score: Rating 10 → score 2, Rating 0 → score 10
        score = max(2.0, 10.0 - most_similar.rating * 0.8)
        return score, f"Duplicate check: similar to '{most_similar.model_id}' ({most_similar.rating}/10)"

    @classmethod
    def _calculate_rating(
        cls,
        *,
        syntax_check: ValidationResult | None,
        custom_rules_check: CustomChecksResult | None,
        complexity_check: ComplexityCheckResult | None,
        duplicate_check: DuplicateCheckResult | None,
        semantic_label_check: SemanticLabelCheckResult | None,
    ) -> tuple[int, dict[str, tuple[float, str]]]:
        """Calculate weighted average rating from all check scores.

        Returns:
            Tuple of (final_rating, scores_dict) where scores_dict maps
            check name to (score, message) tuple.
        """
        scores: dict[str, tuple[float, str]] = {}

        scores["syntax"] = cls._score_syntax(syntax_check)
        scores["custom_rules"] = cls._score_custom_rules(custom_rules_check)
        scores["complexity"] = cls._score_complexity(complexity_check)
        scores["semantic"] = cls._score_semantic(semantic_label_check)
        scores["duplicate"] = cls._score_duplicate(duplicate_check)

        # Weighted average using fixed weights
        rating = (
            scores["syntax"][0] * _EvaluationWeights.SYNTAX
            + scores["custom_rules"][0] * _EvaluationWeights.CUSTOM_RULES
            + scores["complexity"][0] * _EvaluationWeights.COMPLEXITY
            + scores["semantic"][0] * _EvaluationWeights.SEMANTIC
            + scores["duplicate"][0] * _EvaluationWeights.DUPLICATE
        )

        final_rating = max(1, min(10, round(rating)))

        logger.debug(
            "Calculated overall rating: %d (raw: %.2f) from scores: %s",
            final_rating,
            rating,
            {k: v[0] for k, v in scores.items()},
        )

        return final_rating, scores

    @classmethod
    @traceable(run_type="llm", name="Generate Evaluation Summary")
    def _generate_llm_summary(
        cls,
        llm_client: BaseChatModel,
        rating: int,
        scores: dict[str, tuple[float, str]],
    ) -> str:
        """Generate a human-readable summary using LLM."""
        scores_text = "\n".join(f"- {name}: {score:.1f}/10 ({msg})" for name, (score, msg) in scores.items())

        prompt = f"""You are a BPMN quality assessment expert. Based on the evaluation scores below,
write a concise, professional summary of the model's quality assessment.

Provide a coherent paragraph (max 150 tokens) that:
1. States the overall quality level based on the rating
2. Highlights the strongest aspects
3. Mentions areas needing improvement (if any)
4. Gives a brief actionable recommendation

Do NOT list scores numerically. Write in natural, professional language.

Overall Rating: {rating}/10

Individual Scores:
{scores_text}"""

        try:
            response = llm_client.invoke(prompt)
            content = response.content
            if isinstance(content, str) and content:
                return content.strip()
            return cls._fallback_summary(rating, scores)
        except Exception:
            logger.exception("LLM summary generation failed")
            return cls._fallback_summary(rating, scores)

    @staticmethod
    def _fallback_summary(rating: int, scores: dict[str, tuple[float, str]]) -> str:
        """Generate a simple fallback summary without LLM."""
        messages = [msg for _, (_, msg) in scores.items()]
        return f"Rating: {rating}/10. " + " ".join(messages)

    @classmethod
    def create_overall_evaluation(
        cls,
        *,
        syntax_check: ValidationResult | None,
        custom_rules_check: CustomChecksResult | None,
        complexity_check: ComplexityCheckResult | None,
        duplicate_check: DuplicateCheckResult | None,
        semantic_label_check: SemanticLabelCheckResult | None,
        llm_client: BaseChatModel | None = None,
    ) -> ModelEvaluation:
        """Create overall evaluation with weighted average rating and LLM summary.

        Args:
            syntax_check: Results from syntax validation
            custom_rules_check: Results from custom business rules check
            complexity_check: Results from complexity analysis
            duplicate_check: Results from duplicate detection
            semantic_label_check: Results from semantic label validation
            llm_client: Optional LLM client for generating summary. If None, uses fallback.

        Returns:
            ModelEvaluation with rating and summary
        """
        rating, scores = cls._calculate_rating(
            syntax_check=syntax_check,
            custom_rules_check=custom_rules_check,
            complexity_check=complexity_check,
            duplicate_check=duplicate_check,
            semantic_label_check=semantic_label_check,
        )

        if llm_client is not None:
            summary = cls._generate_llm_summary(llm_client, rating, scores)
        else:
            summary = cls._fallback_summary(rating, scores)

        return ModelEvaluation(evaluation_summary=summary, evaluation_rating=rating)
