from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class ProfileBase(BaseModel):
    full_name: Optional[str] = Field(None, max_length=150)
    avatar_url: Optional[str] = Field(None)
    default_currency: str = Field(default="USD", min_length=3, max_length=3)


class ProfileCreate(ProfileBase):
    id: UUID


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=150)
    avatar_url: Optional[str] = Field(None)
    default_currency: Optional[str] = Field(None, min_length=3, max_length=3)


class ProfileResponse(ProfileBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
