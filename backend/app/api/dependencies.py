"""Common dependencies for API endpoints."""

from typing import Annotated
from uuid import UUID
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import TokenPayload, get_current_user
from app.core.logging import set_user_id
from app.db.models.bpmn_model import BPMNModel
from app.db.session import get_db
from app.services.bpmn_model_service import BPMNModelService


async def get_current_user_with_logging(
    user: Annotated[TokenPayload, Depends(get_current_user)],
) -> TokenPayload:
    """Wrapper that sets user_id in logging context after authentication."""
    set_user_id(user.sub)
    return user


# Type alias for authenticated user dependency
CurrentUser = Annotated[TokenPayload, Depends(get_current_user_with_logging)]


async def inject_bpmn_model(model_id: UUID, db: Annotated[AsyncSession, Depends(get_db)]) -> BPMNModel:
    """Dependency to retrieve a BPMN model by its ID.
    Args:
        model_id (UUID): UUID of the BPMN model.
        db (AsyncSession): Database session.

    Returns:
        BPMNModel: BPMN model database object.

    Raises:
        HTTPException: If the BPMN model is not found.
    """
    bpmn_model = await BPMNModelService.get_model_by_id(db, model_id)
    if not bpmn_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BPMN model not found")
    return bpmn_model


BPMNModelDependency = Annotated[BPMNModel, Depends(inject_bpmn_model)]
