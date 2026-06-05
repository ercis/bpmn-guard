"""Pydantic schemas for chat operations."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageSchema(BaseModel):
    """Schema for a chat message."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(description="Unique identifier for this message")
    role: Literal["user", "assistant"] = Field(description="Role of the message sender")
    content: str = Field(description="The message content")
    created_at: datetime = Field(description="When the message was created")


class ChatHistoryResponse(BaseModel):
    """Response containing chat history."""

    messages: list[ChatMessageSchema] = Field(description="List of chat messages")
    total: int = Field(description="Total number of messages")


class ChatRequest(BaseModel):
    """Request body for sending a chat message."""

    report_id: UUID = Field(description="Evaluation report ID")
    message: str = Field(
        description="User message",
        min_length=1,
        max_length=4000,
    )


class ChatResponse(BaseModel):
    """Response from non-streaming chat endpoint."""

    message: ChatMessageSchema = Field(description="The response message")


class ChatDeleteResponse(BaseModel):
    """Response from delete chat history endpoint."""

    success: bool = Field(description="Whether the deletion was successful")
    deleted_count: int = Field(description="Number of messages deleted")
