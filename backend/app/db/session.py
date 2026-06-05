from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError
from typing import AsyncGenerator
from app.core.config import get_settings
import logging
import asyncio

settings = get_settings()
logger = logging.getLogger(__name__)


# Async Engine for FastAPI with proper pooling configuration
# Configured to work with both direct connections and Supabase poolers
# For multi-worker setups: Each worker gets its own pool
async_engine = create_async_engine(
    str(settings.ASYNC_DATABASE_URI),
    pool_size=5,  # Number of persistent connections per worker
    max_overflow=10,  # Additional connections when pool is full
    pool_pre_ping=True,  # Verify connections before using them
    pool_recycle=1800,  # Recycle connections after 30 min (reduced for cloud DBs)
    pool_timeout=10,  # Wait max 10s for a connection from pool before erroring
    echo=False,  # Set to True to log SQL queries for debugging
    connect_args={
        "timeout": 10,  # Connection establishment timeout (seconds)
        "command_timeout": 30,  # Query execution timeout (seconds)
        "server_settings": {
            "application_name": "bpmn-guard",
            "statement_timeout": "30000",  # 30s query timeout (milliseconds)
        },
    },
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# Retry configuration for transient connection failures
MAX_RETRIES = 3
RETRY_DELAY_BASE = 0.5  # Base delay in seconds (exponential backoff)


async def _handle_retry(attempt: int, exception: Exception) -> None:
    """Handle retry logic with exponential backoff for transient connection failures."""
    if attempt < MAX_RETRIES - 1:
        delay = RETRY_DELAY_BASE * (2**attempt)
        logger.warning(
            f"Database connection attempt {attempt + 1}/{MAX_RETRIES} failed: {exception}. Retrying in {delay:.1f}s..."
        )
        await asyncio.sleep(delay)
    else:
        logger.error(f"Database connection failed after {MAX_RETRIES} attempts: {exception}")
        raise exception


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield an AsyncSession per request with retry logic for transient failures.

    Implements exponential backoff for connection errors, which helps during
    brief database restarts (e.g., Supabase maintenance windows).
    """
    last_exception: Exception | None = None

    for attempt in range(MAX_RETRIES):
        try:
            async with AsyncSessionLocal() as session:
                try:
                    yield session
                    return  # Success - exit the retry loop
                except Exception:
                    await session.rollback()
                    raise
        except (OperationalError, SQLAlchemyTimeoutError, TimeoutError, OSError) as e:
            # These are always connection-related errors, safe to retry
            last_exception = e
            await _handle_retry(attempt, e)
        except DBAPIError as e:
            # Only retry DBAPIError if the connection was invalidated (transient failure)
            # Query errors like constraint violations should not be retried
            if not e.connection_invalidated:
                raise
            last_exception = e
            await _handle_retry(attempt, e)

    # Should not reach here, but raise if we do
    if last_exception:
        raise last_exception
