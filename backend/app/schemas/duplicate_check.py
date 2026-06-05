from pydantic import BaseModel, Field


class SimilaritySearchInput(BaseModel):
    """Input schema for similarity search tool."""

    query: str = Field(description="The search query string")
    num_returns: int = Field(default=3, description="Number of results to return")
    filter_columns: dict | None = Field(default=None, description="Optional metadata filters")


class BPMNModelViewInput(BaseModel):
    """Input schema for the BPMNModelViewI tool."""

    file_path: str = Field(description="Path to a specific BPMN model (.bpmn file)", min_length=10)


class ModelRating(BaseModel):
    """Schema to rate a model from the knowledge base."""

    model_id: str = Field(description="Identifier of the BPMN model to be rated")
    model_name: str = Field(default="Unknown", description="Name of the BPMN model")
    rating: int = Field(
        description="Rating of how similar the model is compared to the model under view. "
        "Rating scale from 1 (not similar) to 10 (similar)",
        ge=0,
        le=10,
    )
    reasoning: str = Field(description="Reasoning behind the given rating")


class DuplicateCheckResult(BaseModel):
    """Response schema for duplicate check results."""

    response_answer: str = Field(description="Summarize results and indicates whether duplicates were found")
    similar_models: list[ModelRating] = Field(
        description="List of similar BPMN models with metadata and similarity scores"
    )
