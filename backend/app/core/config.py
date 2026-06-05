from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, model_validator
from functools import lru_cache
from typing import Optional, Self


# ANSI config codes for terminal output
class CONFIG:
    YELLOW = "\033[93m"
    RED = "\033[91m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def print_warning(message: str) -> None:
    """Print a colored warning message"""
    print(f"{CONFIG.YELLOW}{CONFIG.BOLD}WARNING:{CONFIG.RESET} {CONFIG.YELLOW}{message}{CONFIG.RESET}")


class Settings(BaseSettings):
    # Base Project Settings
    PROJECT_NAME: str = Field(default="BPMN Guard")
    API_VERSION_STR: str = Field(default="/api/v1")
    APP_VERSION: str = Field(default="0.1.0")

    # Environment - default to development
    ENVIRONMENT: str = Field(default="development")

    # Logging settings - default to INFO
    LOG_LEVEL: str = Field(default="INFO")

    # Middleware settings
    BACKEND_CORS_ORIGINS: list[str] = Field(default=["http://localhost:8000", "http://localhost:3000"])
    HTTP_METHODS: list[str] = Field(default=["GET", "POST", "PUT", "DELETE"])

    # Database settings
    SYNC_DATABASE_URI: str = Field(default="")
    ASYNC_DATABASE_URI: str = Field(default="")

    # Demo-mode auth: a single hardcoded user, no real login.
    # Flip DEMO_MODE off (and provide a strong JWT_SECRET) to re-enable real JWT verification.
    DEMO_MODE: bool = Field(default=True)
    DEMO_USER_ID: str = Field(default="00000000-0000-0000-0000-000000000001")
    DEMO_USER_EMAIL: str = Field(default="demo@example.com")

    # JWT settings (used when DEMO_MODE is False)
    JWT_SECRET: str = Field(default="demo-mode-insecure-do-not-deploy")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    AUDIENCE: str = Field(default="authenticated")
    ALGORITHM: str = Field(default="HS256")

    # Local filesystem for uploaded BPMN files (path relative to backend working dir, or absolute)
    LOCAL_STORAGE_DIR: str = Field(default="./uploads")

    # APIs
    GEMINI_API_KEY: str = Field(default="")
    OPENAI_API_KEY: str = Field(default="")
    OPENAI_API_ENDPOINT: str = Field(default="")

    # LLM Model Names (with defaults — override via .env for non-OpenAI providers)
    GEMINI_MODEL_NAME: str = Field(default="gemini-2.5-flash")
    OPENAI_MODEL_NAME: str = Field(default="gpt-4o-mini")
    OPENAI_EMBEDDINGS_MODEL: str = Field(default="text-embedding-3-small")

    # BPMN Examples
    BPMN_EXAMPLES_DIR: str = Field(default="")
    VECTOR_DB_INIT: bool = Field(default=False)

    # LangSmith Observability Settings (optional - app works without these)
    LANGSMITH_TRACING: bool = Field(default=False)
    LANGSMITH_API_KEY: str = Field(default="")
    LANGSMITH_PROJECT: str = Field(default="bpmn-guard-workflows")

    @field_validator("BPMN_EXAMPLES_DIR", mode="before")
    @classmethod
    def validate_bpmn_examples_dir(cls, v: Optional[str], info) -> str:
        if not v:
            env = info.data.get("ENVIRONMENT", "development")
            if env == "development":
                print_warning("BPMN_EXAMPLES_DIR is not set. Duplicate checking cant be used.")
                return ""
            else:
                raise ValueError("BPMN_EXAMPLES_DIR must be set in production environment.")
        return v

    @field_validator("SYNC_DATABASE_URI", mode="before")
    @classmethod
    def validate_sync_database_uri(cls, v: Optional[str], info) -> str:
        if not v:
            env = info.data.get("ENVIRONMENT", "development")
            if env == "development":
                print_warning("SYNC_DATABASE_URI is not set. Database operations will fail.")
                return ""
            else:
                raise ValueError("SYNC_DATABASE_URI must be set in production environment.")
        return v

    @field_validator("ASYNC_DATABASE_URI", mode="before")
    @classmethod
    def validate_async_database_uri(cls, v: Optional[str], info) -> str:
        if not v:
            env = info.data.get("ENVIRONMENT", "development")
            if env == "development":
                print_warning("ASYNC_DATABASE_URI is not set. Database operations will fail.")
                return ""
            else:
                raise ValueError("ASYNC_DATABASE_URI must be set in production environment.")
        return v

    @field_validator("GEMINI_API_KEY", mode="before")
    @classmethod
    def validate_gemini_key(cls, v: Optional[str], info) -> str:
        if not v:
            env = info.data.get("ENVIRONMENT", "development")
            if env == "development":
                print_warning("GEMINI_API_KEY is not set. GEMINI_API_KEY calls will fail.")
                return ""
            else:
                raise ValueError("GEMINI_API_KEY must be set in production environment.")
        return v

    @field_validator("OPENAI_API_KEY", mode="before")
    @classmethod
    def validate_openai_key(cls, v: Optional[str], info) -> str:
        if not v:
            env = info.data.get("ENVIRONMENT", "development")
            if env == "development":
                print_warning("OPENAI_API_KEY is not set. OPENAI_API_KEY API calls will fail.")
                return ""
            else:
                raise ValueError("OPENAI_API_KEY must be set in production environment.")
        return v

    @field_validator("OPENAI_API_ENDPOINT", mode="before")
    @classmethod
    def validate_openai_endpoint(cls, v: Optional[str], info) -> str:
        if not v:
            env = info.data.get("ENVIRONMENT", "development")
            if env == "development":
                print_warning("OPENAI_API_ENDPOINT is not set. OPENAI_API_ENDPOINT API calls will fail.")
                return ""
            else:
                raise ValueError("OPENAI_API_ENDPOINT must be set in production environment.")
        return v

    @model_validator(mode="after")
    def validate_langsmith_config(self) -> Self:
        """Validate LangSmith configuration - disable tracing if API key is missing."""
        if self.LANGSMITH_TRACING and not self.LANGSMITH_API_KEY:
            print_warning(
                f"LANGSMITH_API_KEY is missing. LangSmith tracing will be disabled in {self.ENVIRONMENT} environment."
            )
            object.__setattr__(self, "LANGSMITH_TRACING", False)
        return self

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
