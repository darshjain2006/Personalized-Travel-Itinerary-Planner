from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, field_serializer
from app.schemas.profile import ProfileResponse
from app.schemas.trip import TripResponse
from app.schemas.trip_member import TripMemberResponse


class ItineraryItemType(str, Enum):
    ATTRACTION = "attraction"
    DINING = "dining"
    ACCOMMODATION = "accommodation"
    TRANSPORT = "transport"
    ACTIVITY = "activity"


# ------------------------------------------------------------------------------
# Itinerary Item Schemas
# ------------------------------------------------------------------------------
class ItineraryItemBase(BaseModel):
    order_index: int = Field(default=0, ge=0)
    type: ItineraryItemType
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    location: Optional[str] = Field(default=None, max_length=255)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    estimated_cost: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None
    is_locked: bool = Field(default=False)

    @field_serializer("estimated_cost", mode="plain", check_fields=False)
    def serialize_estimated_cost(self, val, _info) -> float:
        return float(val) if val is not None else 0.0


class ItineraryItemCreate(ItineraryItemBase):
    day_id: Optional[UUID] = None


class ItemOrderItem(BaseModel):
    id: UUID
    order_index: int = Field(..., ge=0)


class ReorderItemsRequest(BaseModel):
    day_id: Optional[UUID] = None
    items: Optional[List[ItemOrderItem]] = None
    item_ids: Optional[List[UUID]] = None


class ItineraryItemUpdate(BaseModel):
    order_index: Optional[int] = Field(None, ge=0)
    type: Optional[ItineraryItemType] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    estimated_cost: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None
    is_locked: Optional[bool] = None

    @field_serializer("estimated_cost", mode="plain", check_fields=False)
    def serialize_estimated_cost(self, val, _info) -> Optional[float]:
        return float(val) if val is not None else None


class ItemVoteRequest(BaseModel):
    vote: int = Field(..., ge=-1, le=1, description="1 for upvote, -1 for downvote, 0 to clear vote")


class ItemVoteSummary(BaseModel):
    item_id: UUID
    upvotes: int = 0
    downvotes: int = 0
    score: int = 0
    user_vote: Optional[int] = None


class ItineraryItemResponse(ItineraryItemBase):
    id: UUID
    day_id: UUID
    upvotes: int = 0
    downvotes: int = 0
    score: int = 0
    user_vote: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------------------
# Itinerary Day Schemas
# ------------------------------------------------------------------------------
class ItineraryDayBase(BaseModel):
    day_number: int = Field(..., gt=0)
    date: date
    summary: Optional[str] = None
    estimated_cost: float = Field(default=0.0, ge=0)
    version: int = Field(default=1, gt=0)

    @field_serializer("estimated_cost", mode="plain", check_fields=False)
    def serialize_estimated_cost(self, val, _info) -> float:
        return float(val) if val is not None else 0.0


class ItineraryDayCreate(ItineraryDayBase):
    trip_id: UUID


class ItineraryDayUpdate(BaseModel):
    summary: Optional[str] = None
    estimated_cost: Optional[float] = Field(None, ge=0)
    version: Optional[int] = Field(None, gt=0)

    @field_serializer("estimated_cost", mode="plain", check_fields=False)
    def serialize_estimated_cost(self, val, _info) -> Optional[float]:
        return float(val) if val is not None else None


class ItineraryDayResponse(ItineraryDayBase):
    id: UUID
    trip_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------------------------
# Composite Schemas (Day with Items & Trip with Details)
# ------------------------------------------------------------------------------
class ItineraryDayWithItemsResponse(ItineraryDayResponse):
    items: List[ItineraryItemResponse] = Field(default_factory=list)


class TripWithDetailsResponse(TripResponse):
    owner: Optional[ProfileResponse] = None
    members: List[TripMemberResponse] = Field(default_factory=list)
    days: List[ItineraryDayWithItemsResponse] = Field(default_factory=list)
