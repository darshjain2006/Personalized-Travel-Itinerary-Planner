from typing import List, Optional
from pydantic import BaseModel, Field, field_serializer
from app.schemas.itinerary import ItineraryItemType


class GenerateItineraryRequest(BaseModel):
    """Optional user constraints for full itinerary generation."""
    must_include: Optional[List[str]] = Field(default=None, description="Monuments, restaurants, or experiences that must be included")
    avoid: Optional[List[str]] = Field(default=None, description="Themes, venues, or areas to avoid")


class RegenerateDayRequest(BaseModel):
    """Parameters to guide single day regeneration."""
    instruction: Optional[str] = Field(default=None, description="Free-text refinement, e.g. 'more food, less walking'")
    must_include: Optional[List[str]] = Field(default=None, description="Specific activities to add to this day")
    avoid: Optional[List[str]] = Field(default=None, description="Specific elements to exclude from this day")


class ReplaceItemRequest(BaseModel):
    """Parameters to guide single activity replacement."""
    instruction: Optional[str] = Field(default=None, description="Reason or instruction, e.g. 'cheaper option' or 'indoor venue'")
    preference: Optional[str] = Field(default=None, description="Optional style preference, e.g. 'historic' or 'culinary'")


# ------------------------------------------------------------------------------
# Gemini Structured Output Models
# ------------------------------------------------------------------------------

class GeneratedItem(BaseModel):
    order_index: int = Field(default=0, ge=0)
    type: ItineraryItemType
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[str] = Field(default=None, description="HH:MM:SS format")
    end_time: Optional[str] = Field(default=None, description="HH:MM:SS format")
    estimated_cost: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None

    @field_serializer("estimated_cost", mode="plain", check_fields=False)
    def serialize_estimated_cost(self, val, _info) -> float:
        return float(val) if val is not None else 0.0


class GeneratedDay(BaseModel):
    day_number: int = Field(..., gt=0)
    date: Optional[str] = None
    summary: str
    estimated_cost: float = Field(default=0.0, ge=0)
    items: List[GeneratedItem] = Field(default_factory=list)

    @field_serializer("estimated_cost", mode="plain", check_fields=False)
    def serialize_estimated_cost(self, val, _info) -> float:
        return float(val) if val is not None else 0.0


class GeneratedItinerary(BaseModel):
    title: str
    summary: str
    total_estimated_cost: float = Field(default=0.0, ge=0)
    days: List[GeneratedDay] = Field(default_factory=list)

    @field_serializer("total_estimated_cost", mode="plain", check_fields=False)
    def serialize_total_estimated_cost(self, val, _info) -> float:
        return float(val) if val is not None else 0.0


class GeneratedItemReplacement(BaseModel):
    type: ItineraryItemType
    title: str = Field(..., min_length=1)
    description: str
    location: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    estimated_cost: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None
    reason: Optional[str] = None

    @field_serializer("estimated_cost", mode="plain", check_fields=False)
    def serialize_estimated_cost(self, val, _info) -> float:
        return float(val) if val is not None else 0.0
