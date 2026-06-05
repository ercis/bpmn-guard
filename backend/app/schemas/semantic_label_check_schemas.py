from pydantic import BaseModel, Field


class SemanticLabelViolation(BaseModel):
    """Schema for a single semantic label violation in a BPMN model."""

    bpmn_element_id: str = Field(description="The ID of the BPMN element with the violation.")
    rule_id: str = Field(description="The ID of the rule that was violated.")
    explanation: str = Field(description="Explanation why the rule was violated.")


class SemanticLabelCheckResult(BaseModel):
    """Schema for semantic label check review."""

    rating: int = Field(ge=0, le=100, description="Rating score between 0 and 100, where 100 is best.")
    evaluation: str = Field(description="Detailed explanation of the rating with a summary for the user.")
    violations: list[SemanticLabelViolation] = Field(
        description="List of violations found during the semantic label check."
    )
