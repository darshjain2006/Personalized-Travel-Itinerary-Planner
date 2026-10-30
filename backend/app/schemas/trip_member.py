from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.profile import ProfileResponse


class TripRole(str, Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


class TripMemberBase(BaseModel):
    role: TripRole = Field(default=TripRole.VIEWER)


class TripMemberCreate(TripMemberBase):
    trip_id: UUID
    user_id: UUID


class TripMemberUpdate(BaseModel):
    role: TripRole


class InviteMemberRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255, description="Email of the user to invite")
    role: TripRole = Field(default=TripRole.VIEWER, description="Role to grant: owner, editor, or viewer")


class TripMemberResponse(TripMemberBase):
    trip_id: UUID
    user_id: UUID
    joined_at: datetime
    profile: Optional[ProfileResponse] = None

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------------------
# Group Member Preferences Schemas
# ------------------------------------------------------------------------------

class MemberPreferenceCreate(BaseModel):
    interests: List[str] = Field(default_factory=list, description="Member travel interests")
    budget_cap: Optional[Decimal] = Field(None, ge=0, description="Member personal budget ceiling")
    notes: Optional[str] = Field(None, max_length=1000, description="Dietary, mobility, or bucket-list requests")


class MemberPreferenceResponse(BaseModel):
    trip_id: UUID
    user_id: UUID
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    budget_cap: Optional[Decimal] = None
    notes: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GroupPreferencesSummaryResponse(BaseModel):
    trip_id: UUID
    preferences: List[MemberPreferenceResponse]
    merged_interests: List[str]
    effective_budget_cap: Optional[Decimal] = None
    conflicts: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
