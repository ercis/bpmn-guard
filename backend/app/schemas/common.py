"""Common schemas for pydantic validation."""

from pydantic import BaseModel, Field
from enum import Enum


class HealthCheck(BaseModel):
    """
    Response model to validate and return when performing a health check.
    """

    status: str = Field(default="unknown", description="Overall health status: ok, degraded, or unknown")
    database: str = Field(default="unknown", description="Database connection status")
    llm_api: str = Field(default="unknown", description="LLM API configuration status")
    bpmn_validation: str = Field(default="unknown", description="BPMN validation service status")


class LLMProvider(str, Enum):
    """
    Specified llm providers for llm client.
    """

    AZURE = "azure_openai"
    OPENAI = "openai"
    GEMINI = "google_genai"
