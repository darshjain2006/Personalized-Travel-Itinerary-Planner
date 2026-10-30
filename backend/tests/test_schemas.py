from datetime import date, time
from decimal import Decimal
from uuid import uuid4
import pytest
from app.schemas import (
    TripCreate,
    TravelerType,
    BudgetLevel,
    Pace,
    TripStatus,
    ItineraryDayCreate,
    ItineraryItemCreate,
    ItineraryItemType,
    TripMemberCreate,
    TripRole,
    ProfileCreate,
)


def test_trip_schema_validation():
    trip_data = TripCreate(
        title="Tokyo Exploration",
        destination="Tokyo, Japan",
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 7),
        num_travelers=2,
        traveler_type=TravelerType.COUPLE,
        budget_total=Decimal("3500.00"),
        budget_level=BudgetLevel.PREMIUM,
        pace=Pace.RELAXED,
        interests=["food", "culture", "nature"],
    )
    assert trip_data.title == "Tokyo Exploration"
    assert trip_data.traveler_type == TravelerType.COUPLE
    assert trip_data.status == TripStatus.DRAFT


def test_trip_date_validation_failure():
    with pytest.raises(ValueError, match="end_date cannot be earlier than start_date"):
        TripCreate(
            title="Invalid Dates Trip",
            destination="Rome, Italy",
            start_date=date(2026, 11, 10),
            end_date=date(2026, 11, 5),
        )


def test_itinerary_and_member_schemas():
    user_id = uuid4()
    trip_id = uuid4()
    day_id = uuid4()

    profile = ProfileCreate(id=user_id, full_name="Alex Traveler", default_currency="EUR")
    assert profile.default_currency == "EUR"

    member = TripMemberCreate(trip_id=trip_id, user_id=user_id, role=TripRole.EDITOR)
    assert member.role == TripRole.EDITOR

    day = ItineraryDayCreate(
        trip_id=trip_id,
        day_number=1,
        date=date(2026, 11, 1),
        summary="Arrival & Shibuya Crossing",
        estimated_cost=Decimal("150.00"),
    )
    assert day.day_number == 1

    item = ItineraryItemCreate(
        day_id=day_id,
        order_index=1,
        type=ItineraryItemType.ATTRACTION,
        title="Meiji Shrine Visit",
        location="Shibuya, Tokyo",
        start_time=time(10, 0),
        end_time=time(12, 0),
        estimated_cost=Decimal("0.00"),
    )
    assert item.type == ItineraryItemType.ATTRACTION
    assert item.is_locked is False
