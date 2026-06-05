"""Centralized error handling utilities.

Provides a helper to raise HTTPExceptions with sanitized messages
while logging full error details server-side.
"""

import logging
from typing import NoReturn

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

# Map of status codes to default sanitized messages
DEFAULT_MESSAGES = {
    status.HTTP_400_BAD_REQUEST: "Bad request",
    status.HTTP_401_UNAUTHORIZED: "Unauthorized",
    status.HTTP_403_FORBIDDEN: "Forbidden",
    status.HTTP_404_NOT_FOUND: "Resource not found",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "Internal server error",
}


def raise_http_error(
    status_code: int,
    message: str | None = None,
    error: Exception | None = None,
) -> NoReturn:
    """
    Log full error details and raise a sanitized HTTPException.

    Args:
        status_code: HTTP status code to return
        message: Sanitized message to return to client (uses default if None)
        error: The original exception (logged with traceback for 5xx, not exposed to client)

    Raises:
        HTTPException: Always raises with the given status code
    """
    client_msg = message or DEFAULT_MESSAGES.get(status_code, "An error occurred")

    log_fn = logger.error if status_code >= 500 else logger.warning
    if error:
        log_fn(f"{client_msg}: {error}", exc_info=error if status_code >= 500 else None)
    else:
        log_fn(client_msg)

    raise HTTPException(status_code=status_code, detail=client_msg)
