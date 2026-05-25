"""DevLens AI — Session & User Schemas"""
import uuid
from datetime import datetime
from pydantic import BaseModel
from app.schemas.chat import ChatMessage


class SessionResponse(BaseModel):
    id: uuid.UUID
    repo_id: uuid.UUID
    chat_history: list[ChatMessage]
    created_at: datetime
    last_active_at: datetime
    expires_at: datetime
    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: uuid.UUID
    github_id: int
    github_username: str
    github_name: str | None
    github_avatar_url: str | None
    api_key: str
    created_at: datetime
    model_config = {"from_attributes": True}
