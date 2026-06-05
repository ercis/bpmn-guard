"""Class for creating a large language model client with langchain."""

import logging
from typing import cast, Any

from langchain_openai.embeddings import OpenAIEmbeddings
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel
from pydantic import SecretStr

from app.core.config import get_settings
from app.schemas.common import LLMProvider

logger = logging.getLogger(__name__)
settings = get_settings()

# Default timeout and retry settings for LLM API calls
DEFAULT_TIMEOUT = 120  # seconds
DEFAULT_MAX_RETRIES = 3


class LLMClient:
    """Class for a large language model client."""

    def __init__(
        self,
        provider: LLMProvider = LLMProvider.OPENAI,
        model_deployment_name: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: int = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ):
        """Initialize the base language model client.

        Attributes:
            :param provider: The LLM provider (e.g., OpenAI, Gemini, Azure).
            :param model_deployment_name: The name of the model deployment.
            :param temperature: The temperature setting for the model.
            :param max_tokens: The maximum number of tokens to generate.
            :param timeout: Timeout in seconds for API calls.
            :param max_retries: Maximum number of retries for failed API calls.
        """

        self.provider = provider
        # Set appropriate default model based on provider (from settings or hardcoded fallback)
        if model_deployment_name is None:
            if provider == LLMProvider.GEMINI:
                model_deployment_name = settings.GEMINI_MODEL_NAME
            elif provider == LLMProvider.OPENAI:
                model_deployment_name = settings.OPENAI_MODEL_NAME
        self.model_deployment = model_deployment_name
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout = timeout
        self.max_retries = max_retries

    def create_llm_model(self) -> BaseChatModel:
        """Return langchain (agent) compatible LLM model client."""
        logger.info(f"Creating LLM client: provider={self.provider.value}, model={self.model_deployment}")
        if self.provider == LLMProvider.AZURE:
            return cast(
                BaseChatModel,
                init_chat_model(
                    model=self.model_deployment,
                    model_provider="azure_openai",
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_API_ENDPOINT,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                    timeout=self.timeout,
                    max_retries=self.max_retries,
                ),
            )
        if self.provider == LLMProvider.OPENAI:
            return cast(
                BaseChatModel,
                init_chat_model(
                    model=self.model_deployment,
                    model_provider="openai",
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_API_ENDPOINT,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                    timeout=self.timeout,
                    max_retries=self.max_retries,
                ),
            )
        if self.provider == LLMProvider.GEMINI:
            return cast(
                BaseChatModel,
                init_chat_model(
                    model=self.model_deployment,
                    model_provider="google_genai",
                    api_key=settings.GEMINI_API_KEY,
                    timeout=self.timeout,
                    max_retries=self.max_retries,
                ),
            )
        error_msg = "Deployment or provider not specified"
        raise ValueError(error_msg)

    @staticmethod
    def get_embedding_function() -> OpenAIEmbeddings:
        """Return langchain compatible embedding function."""
        logger.info(f"Creating embedding function: model={settings.OPENAI_EMBEDDINGS_MODEL}")

        extra_kwargs: dict[str, Any] = {}
        if settings.OPENAI_EMBEDDINGS_MODEL == "Qwen3-Embedding-4B":
            # Some OpenAI-compatible proxies in front of Qwen reject both the OpenAI SDK's
            # default base64 encoding and a null override; force the plain "float" encoding.
            extra_kwargs["model_kwargs"] = {"encoding_format": "float"}

        return OpenAIEmbeddings(
            api_key=SecretStr(settings.OPENAI_API_KEY),
            base_url=settings.OPENAI_API_ENDPOINT,
            model=settings.OPENAI_EMBEDDINGS_MODEL,
            timeout=DEFAULT_TIMEOUT,
            max_retries=DEFAULT_MAX_RETRIES,
            **extra_kwargs,
        )
