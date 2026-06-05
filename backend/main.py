"""Main entry point for the backend."""

import asyncio
import os
from pathlib import Path

import uvicorn
import logging
from collections.abc import Callable
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import Response
from contextlib import asynccontextmanager

from app.core.logging import setup_logging, set_request_id
from app.core.config import get_settings
from app.api.endpoints import api_router
from app.db.session import get_db
from app.services.bpmn_validation_services import setup_bpmn_validation, BPMNValidationError
from sqlalchemy import text

from app.db.vector_storage import VectorDB
from app.language_model_client.client import LLMClient
from app.agents.workflows.evaluation_workflow import EvaluationWorkflow

# Settings
settings = get_settings()

# Setup logging on startup
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logs
    logger.info(f"Starting application in {settings.ENVIRONMENT} environment")
    logger.info(f"Log level set to {settings.LOG_LEVEL}")
    logger.debug("Debug logging is enabled")

    # Configure LangSmith environment variables (SDK reads from os.environ)
    if settings.LANGSMITH_TRACING and settings.LANGSMITH_API_KEY:
        os.environ["LANGSMITH_TRACING"] = "true"
        os.environ["LANGSMITH_API_KEY"] = settings.LANGSMITH_API_KEY
        os.environ["LANGSMITH_PROJECT"] = settings.LANGSMITH_PROJECT

    # Ensure local storage directory exists
    storage_dir = Path(settings.LOCAL_STORAGE_DIR).resolve()
    storage_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Local storage dir ready at {storage_dir}")

    # Setup BPMN validation dependencies
    logger.info("Setting up BPMN validation service")
    try:
        setup_bpmn_validation()
        logger.info("BPMN validation service setup successfully")
    except BPMNValidationError as e:
        logger.warning(f"BPMN validation service unavailable: {e}")

    # Database connection check with timeout
    # get_db() has retry logic, but we add an outer timeout to prevent startup hanging
    logger.info("Connecting to database")
    try:
        async with asyncio.timeout(15.0):  # Allow time for retries but don't hang forever
            async for db in get_db():
                await db.execute(text("SELECT 1"))
                logger.info("Database connection established successfully")
                break
    except asyncio.TimeoutError:
        logger.error("Database connection timed out during startup, app will not function correctly")
    except asyncio.CancelledError:
        logger.error(
            "Database connection cancelled during startup (likely maintenance), app will not function correctly"
        )
    except Exception as e:
        logger.error(f"Database connection failed, app will not function correctly: {e}")

    # Apply Alembic migrations so tables exist on a fresh database.
    # Idempotent: a no-op once everything is up to date.
    logger.info("Applying database migrations")
    try:
        from alembic import command
        from alembic.config import Config as AlembicConfig

        alembic_cfg = AlembicConfig(str(Path(__file__).parent / "alembic.ini"))
        await asyncio.to_thread(command.upgrade, alembic_cfg, "head")
        logger.info("Database migrations applied successfully")
    except Exception as e:
        logger.error(f"Database migrations failed: {e}")

    logger.info("Insert BPMN model descriptions into vector storage, if necessary.")
    try:
        if settings.VECTOR_DB_INIT:
            logger.info("VECTOR_DB_INIT is enabled, inserting BPMN model descriptions.")
            llm_client = LLMClient().create_llm_model()
            embeddings = LLMClient.get_embedding_function()
            vector_storage = VectorDB.create_pg_vector_db(
                settings.SYNC_DATABASE_URI, "bpmn_examples_corpus", embeddings, pre_delete_collection=True
            )
            VectorDB.fill_pg_vector_db(vector_storage, Path(settings.BPMN_EXAMPLES_DIR), llm_client)
            logger.info("BPMN model descriptions inserted successfully")
        else:
            logger.info("VECTOR_DB_INIT is disabled. Vector storage initialization skipped.")
    except Exception as e:
        logger.warning(f"Vector storage initialization failed, duplicate check unavailable: {e}")

    logger.info("Compiling Graph for evaluation workflow.")
    try:
        app.state.evaluation_workflow_graph = EvaluationWorkflow.compile_workflow()
        logger.info("Evaluation workflow compiled successfully.")
    except Exception as e:
        logger.warning(f"Evaluation workflow unavailable: {e}")
        app.state.evaluation_workflow_graph = None

    # LangSmith observability status
    if settings.LANGSMITH_TRACING:
        logger.info(f"LangSmith tracing is ENABLED (project: {settings.LANGSMITH_PROJECT})")
    else:
        logger.info("LangSmith tracing is DISABLED")

    yield

    # Shutdown logs
    logger.info("Shutting down application")


# Get logger for middleware and other module-level code
logger = logging.getLogger(__name__)


async def request_id_middleware(request: Request, call_next: Callable) -> Response:
    """Set request ID for logging context and log HTTP requests."""
    # Use X-Request-ID header if provided, otherwise generate one
    header_request_id = request.headers.get("X-Request-ID")
    request_id = set_request_id(header_request_id)

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id

    # Log HTTP request/response (replaces uvicorn access logs)
    logger.info(f"{request.method} {request.url.path} - {response.status_code}")

    return response


async def catch_exceptions_middleware(request: Request, call_next: Callable) -> Response:
    """Catch exceptions and handle them.

    Configured this way so the CORS middleware can catch exceptions and still return
    the appropriate headers.

    See https://github.com/fastapi/fastapi/issues/775#issuecomment-592946834.
    """
    try:
        return await call_next(request)
    except Exception as e:
        msg = f"Internal server error: {e}"
        logger.exception(msg)
        return Response("Internal server error", status_code=500)


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan, version=settings.APP_VERSION)

# Middleware execution order is reverse of registration (last registered runs first/outermost)
# So request_id_middleware runs first, ensuring request ID is set before exception handling
app.middleware("http")(catch_exceptions_middleware)
app.middleware("http")(request_id_middleware)
# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(o) for o in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=[str(o) for o in settings.HTTP_METHODS],
    allow_headers=["*"],
)
# Enable GZip compression (useful since we're returning images in base64)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routes
app.include_router(api_router, prefix=settings.API_VERSION_STR)

# Development-only entry point
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level=settings.LOG_LEVEL.lower(),
        access_log=False,  # Disable duplicate access logs
    )
