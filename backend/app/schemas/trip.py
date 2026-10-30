from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, model_validator, field_serializer


class TravelerType(str, Enum):
    SOLO = "solo"
    COUPLE = "couple"
    GROUP = "group"


class BudgetLevel(str, Enum):
    BUDGET = "budget"
    MID = "mid"
    PREMIUM = "premium"


class Pace(str, Enum):
    RELAXED = "relaxed"
    BALANCED = "balanced"
    PACKED = "packed"


class TripStatus(str, Enum):
    DRAFT = "draft"
    GENERATED = "generated"
    ARCHIVED = "archived"


class TripBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    destination: str = Field(..., min_length=1, max_length=200)
    start_date: date
    end_date: date
    num_travelers: int = Field(default=1, gt=0)
    traveler_type: TravelerType = Field(default=TravelerType.SOLO)
    budget_total: Optional[float] = Field(default=None, ge=0)
    budget_level: BudgetLevel = Field(default=BudgetLevel.MID)
    pace: Pace = Field(default=Pace.BALANCED)
    interests: List[str] = Field(default_factory=list)
    accommodation_pref: Optional[str] = Field(default=None, max_length=100)
    transport_pref: Optional[str] = Field(default=None, max_length=100)
    status: TripStatus = Field(default=TripStatus.DRAFT)

    @field_serializer("budget_total", mode="plain", check_fields=False)
    def serialize_budget_total(self, val, _info) -> Optional[float]:
        return float(val) if val is not None else None

    @model_validator(mode="after")
    def validate_dates(self) -> "TripBase":
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date")
        return self


class TripCreate(TripBase):
    pass


class TripUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    destination: Optional[str] = Field(None, min_length=1, max_length=200)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    num_travelers: Optional[int] = Field(None, gt=0)
    traveler_type: Optional[TravelerType] = None
    budget_total: Optional[float] = Field(None, ge=0)
    budget_level: Optional[BudgetLevel] = None
    pace: Optional[Pace] = None
    interests: Optional[List[str]] = None
    accommodation_pref: Optional[str] = None
    transport_pref: Optional[str] = None
    status: Optional[TripStatus] = None

    @field_serializer("budget_total", mode="plain", check_fields=False)
    def serialize_budget_total(self, val, _info) -> Optional[float]:
        return float(val) if val is not None else None

    @model_validator(mode="after")
    def validate_update_dates(self) -> "TripUpdate":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date")
        return self


class TripResponse(TripBase):
    id: UUID
    owner_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
