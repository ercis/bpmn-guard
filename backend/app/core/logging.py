import logging
import sys
import uuid
from collections.abc import Awaitable, Callable
from contextvars import ContextVar, copy_context
from functools import wraps
from typing import ParamSpec, TypeVar

import coloredlogs

from app.core.config import get_settings

P = ParamSpec("P")
R = TypeVar("R")

# Context variables for request tracking
request_id_var: ContextVar[str] = ContextVar("request_id", default="_")
user_id_var: ContextVar[str] = ContextVar("user_id", default="_")


def get_request_id() -> str:
    """Get the current request ID from context."""
    return request_id_var.get()


def set_request_id(request_id: str | None = None) -> str:
    """Set a request ID in context. Generates one if not provided."""
    resolved_request_id = request_id or str(uuid.uuid4())[:8]
    request_id_var.set(resolved_request_id)
    return resolved_request_id


def get_user_id() -> str:
    """Get the current user ID from context."""
    return user_id_var.get()


def set_user_id(user_id: str | None = None) -> str:
    """Set a user ID in context and return the resolved value."""
    resolved_user_id = user_id or "_"
    user_id_var.set(resolved_user_id)
    return resolved_user_id


def with_logging_context(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
    """
    Decorator that preserves logging context (request_id, user_id) for async background tasks.

    Python's ContextVar values are not automatically propagated to background tasks.
    This decorator captures the current context at decoration time and restores it
    when the background task runs.

    Usage:
        @with_logging_context
        async def my_background_task(...):
            # request_id and user_id will be available here
            logger.info("This log will include the original request context")

    Note:
        Apply this decorator to functions passed to BackgroundTasks.add_task()
        to maintain request traceability in background task logs.
    """
    # Capture context at the time the wrapper is created (i.e., when add_task is called)
    ctx = copy_context()

    @wraps(func)
    async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        # Run the function within the captured context
        return await ctx.run(func, *args, **kwargs)

    return wrapper


class RequestContextFilter(logging.Filter):
    """Logging filter that adds request_id and user_id to log records."""

    def filter(self, record):
        record.request_id = get_request_id()
        record.user_id = get_user_id()
        return True


class _StreamByLevelHandler(logging.StreamHandler):
    """Routes ERROR+ to stderr (Railway "error") and everything else to stdout (Railway "info")."""

    def __init__(self):
        super().__init__(stream=sys.stdout)
        self._stderr = sys.stderr

    def emit(self, record):
        self.stream = self._stderr if record.levelno >= logging.ERROR else sys.stdout
        super().emit(record)


def setup_logging():
    """
    Simple logging setup with colored console output.

    Features:
    - Environment-aware log levels (respects LOG_LEVEL from settings)
    - Colored console output in non-production environments
    - Routes ERROR/CRITICAL to stderr and everything else to stdout
      so Railway maps log levels correctly.
    """
    settings = get_settings()
    environment = settings.ENVIRONMENT.lower()
    log_level_str = settings.LOG_LEVEL.upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    # Format includes request_id and user_id for tracing
    log_format = (
        "%(asctime)s - %(name)s - p-%(process)d - %(levelname)s - r-%(request_id)s - u-%(user_id)s - %(message)s"
    )

    # Create the filter instance
    context_filter = RequestContextFilter()

    root_logger = logging.getLogger()

    if environment != "production":
        coloredlogs.install(level=log_level, fmt=log_format, stream=sys.stdout, reconfigure=True)
        # Swap out the handler coloredlogs installed with our level-aware one
        formatter = root_logger.handlers[0].formatter if root_logger.handlers else logging.Formatter(log_format)
        for h in root_logger.handlers[:]:
            root_logger.removeHandler(h)
        level_handler = _StreamByLevelHandler()
        level_handler.setFormatter(formatter)
        root_logger.addHandler(level_handler)
    else:
        level_handler = _StreamByLevelHandler()
        level_handler.setFormatter(logging.Formatter(log_format))
        root_logger.addHandler(level_handler)

    root_logger.setLevel(log_level)

    # Add context filter to root logger and all its handlers
    root_logger.addFilter(context_filter)
    for handler in root_logger.handlers:
        handler.addFilter(context_filter)

    logging.info(
        f"Logging configured: level={log_level_str}, environment={environment}, colored={environment != 'production'}"
    )
