import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional
from app.schemas.ai import GeneratedItinerary, GeneratedDay, GeneratedItem, GeneratedItemReplacement
from app.schemas.trip import TravelerType, BudgetLevel, Pace

logger = logging.getLogger("ai.fallback")


def generate_fallback_itinerary(
    destination: str,
    start_date: date,
    end_date: date,
    traveler_type: TravelerType = TravelerType.SOLO,
    num_travelers: int = 1,
    budget_total: Optional[Decimal] = None,
    budget_level: BudgetLevel = BudgetLevel.MID,
    pace: Pace = Pace.BALANCED,
    interests: Optional[List[str]] = None,
) -> GeneratedItinerary:
    """Generates a high-quality, realistic fallback itinerary if the LLM provider fails,
    times out, or encounters quota exhaustion. Ensures users are never blocked.
    """
    logger.warning(
        f"Activating graceful fallback itinerary generator for {destination} ({start_date} to {end_date})"
    )

    total_days = max(1, (end_date - start_date).days + 1)

    # Cost allocation per item based on budget level
    if budget_level == BudgetLevel.PREMIUM:
        stay_cost, dining_cost, attr_cost, transit_cost = 250.0, 85.0, 50.0, 30.0
    elif budget_level == BudgetLevel.BUDGET:
        stay_cost, dining_cost, attr_cost, transit_cost = 45.0, 15.0, 10.0, 5.0
    else:  # MID
        stay_cost, dining_cost, attr_cost, transit_cost = 120.0, 35.0, 25.0, 15.0

    interests_summary = ", ".join(interests) if interests else "Historic landmarks, scenic views, local culinary scene"

    days: List[GeneratedDay] = []
    for day_idx in range(total_days):
        day_num = day_idx + 1
        day_date = start_date + timedelta(days=day_idx)

        items: List[GeneratedItem] = [
            GeneratedItem(
                type="accommodation",
                title=f"Check-in & Morning Refresh in Central {destination}",
                description="Settle into your accommodation, unpack essentials, and prepare for the day's itinerary.",
                location=f"Central District, {destination}",
                start_time="08:30:00",
                end_time="09:30:00",
                estimated_cost=stay_cost if day_num == 1 else 0.0,
                notes="Keep booking reference and digital keys handy on your phone.",
            ),
            GeneratedItem(
                type="dining",
                title=f"Artisanal Morning Breakfast & Coffee",
                description="Enjoy local pastries, freshly roasted coffee, and traditional morning specialties.",
                location=f"Old Town Market, {destination}",
                start_time="09:45:00",
                end_time="10:45:00",
                estimated_cost=round(dining_cost * 0.6, 2),
                notes="Recommended for outdoor terrace seating.",
            ),
            GeneratedItem(
                type="attraction",
                title=f"Historic Highlights & Landmark Walking Tour",
                description=f"Explore iconic heritage monuments, architecture, and cultural landmarks across {destination}.",
                location=f"Heritage Quarter, {destination}",
                start_time="11:00:00",
                end_time="13:30:00",
                estimated_cost=attr_cost,
                notes="Wear comfortable walking shoes; photography permitted.",
            ),
            GeneratedItem(
                type="dining",
                title=f"Regional Lunch Tasting Experience",
                description="Sample authentic regional dishes featuring fresh seasonal ingredients in a lively bistro.",
                location=f"Culinary Lane, {destination}",
                start_time="13:45:00",
                end_time="15:00:00",
                estimated_cost=dining_cost,
                notes="Try the daily chef's seasonal recommendation.",
            ),
            GeneratedItem(
                type="activity",
                title=f"Afternoon Discovery & Neighborhood Walk",
                description=f"Stroll through boutique-lined avenues, artisan workshops, and scenic public squares in {destination}.",
                location=f"Arts & Design District, {destination}",
                start_time="15:30:00",
                end_time="18:00:00",
                estimated_cost=0.0,
                notes="Great spot for souvenirs and cultural immersion.",
            ),
            GeneratedItem(
                type="dining",
                title=f"Atmospheric Evening Dinner",
                description="Unwind over an exceptional dinner featuring warm hospitality and local wine or regional drinks.",
                location=f"Riverfront Promenade, {destination}",
                start_time="19:00:00",
                end_time="21:00:00",
                estimated_cost=round(dining_cost * 1.2, 2),
                notes="Advance reservations recommended during peak hours.",
            ),
        ]

        # Filter items if pace is relaxed
        if pace == Pace.RELAXED:
            # Drop the afternoon extra activity
            items = [item for item in items if item.title != f"Afternoon Discovery & Neighborhood Walk"]

        day_cost = round(sum(float(item.estimated_cost) for item in items), 2)
        days.append(
            GeneratedDay(
                day_number=day_num,
                date=day_date.isoformat(),
                summary=f"Day {day_num}: Essential {destination} & {interests_summary.split(',')[0]}",
                estimated_cost=day_cost,
                items=items,
            )
        )

    total_cost = round(sum(float(d.estimated_cost) for d in days), 2)

    return GeneratedItinerary(
        title=f"Curated {total_days}-Day Itinerary for {destination}",
        summary=f"A balanced and authentic travel itinerary discovering {destination} with carefully sequenced attractions, dining, and scenic walks.",
        total_estimated_cost=total_cost,
        days=days,
    )


def generate_fallback_day(
    destination: str,
    day_number: int,
    day_date: date,
    budget_level: BudgetLevel = BudgetLevel.MID,
    pace: Pace = Pace.BALANCED,
) -> GeneratedDay:
    """Fallback generator for single-day regeneration."""
    full = generate_fallback_itinerary(
        destination=destination,
        start_date=day_date,
        end_date=day_date,
        budget_level=budget_level,
        pace=pace,
    )
    fallback_day = full.days[0]
    fallback_day.day_number = day_number
    fallback_day.date = day_date.isoformat()
    return fallback_day


def generate_fallback_replacement(item_title: str, item_type: str = "activity") -> GeneratedItemReplacement:
    """Fallback recommendation for single item replacement."""
    return GeneratedItemReplacement(
        title=f"Curated Alternative: Scenic Cultural Experience",
        type=item_type if item_type in ("attraction", "dining", "activity", "transport", "accommodation") else "activity",
        description=f"A popular local alternative recommendation replacing '{item_title}', offering great ambiance and cultural value.",
        location="City Center Cultural Hub",
        start_time="14:00:00",
        end_time="16:00:00",
        estimated_cost=25.0,
        notes="Locally favored alternative with flexible entry.",
        reason="Provides comparable cultural experience and convenient timing.",
    )
