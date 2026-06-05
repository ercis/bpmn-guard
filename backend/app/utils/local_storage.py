"""Local-filesystem replacement for the previous Supabase Storage helper.

Files are kept under settings.LOCAL_STORAGE_DIR; callers pass relative paths
(e.g. "models/20240101_abcd1234_diagram.bpmn") that mirror the layout the
previous Supabase bucket used, so DB rows ported over without migration.
"""

import logging
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class LocalStorageError(Exception):
    pass


def _root() -> Path:
    root = Path(get_settings().LOCAL_STORAGE_DIR).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def resolve(relative_path: str) -> Path:
    """Resolve a relative storage path, refusing anything that escapes the storage root."""
    if not relative_path or relative_path.startswith("/"):
        raise LocalStorageError(f"Invalid storage path: {relative_path!r}")
    root = _root()
    target = (root / relative_path).resolve()
    if root not in target.parents and target != root:
        raise LocalStorageError(f"Path traversal blocked: {relative_path!r}")
    return target


def save_file(relative_path: str, content: bytes) -> None:
    target = resolve(relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    logger.debug(f"Saved file to local storage: {target}")


def read_file(relative_path: str) -> bytes:
    target = resolve(relative_path)
    if not target.is_file():
        raise FileNotFoundError(f"File not found in local storage: {relative_path}")
    return target.read_bytes()


def delete_file(relative_path: str) -> None:
    """Best-effort delete; missing files are not an error."""
    try:
        target = resolve(relative_path)
    except LocalStorageError as e:
        logger.warning(f"Refusing to delete suspicious path: {e}")
        return
    try:
        target.unlink(missing_ok=True)
        logger.debug(f"Deleted file from local storage: {target}")
    except OSError as e:
        logger.warning(f"Failed to delete {target}: {e}")
