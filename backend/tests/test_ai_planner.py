from datetime import date
from decimal import Decimal
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user
from app.schemas.ai import (
    GeneratedItinerary,
    GeneratedDay,
    GeneratedItem,
    GeneratedItemReplacement,
)
from app.schemas.itinerary import ItineraryItemType
from app.schemas.trip import TravelerType, BudgetLevel, Pace
from app.services.prompts import (
    SYSTEM_PROMPT,
    build_full_itinerary_prompt,
    build_day_regeneration_prompt,
    build_item_replacement_prompt,
)
from app.services.ai_planner import AIPlannerService, ai_planner_service
from app.repositories.data_store import data_store
from tests.conftest import TEST_USER_ID, OTHER_USER_ID


# ==============================================================================
# 1. PROMPT ENGINEERING TESTS
# ==============================================================================

def test_system_prompt_principles():
    """Verify that the system prompt encodes all required local expert principles."""
    assert "GEOGRAPHICAL CLUSTERING" in SYSTEM_PROMPT
    assert "STRICT BUDGET ADHERENCE" in SYSTEM_PROMPT
    assert "ADAPTIVE PACING" in SYSTEM_PROMPT
    assert "TRAVELER TYPE SPECIALIZATION" in SYSTEM_PROMPT
    assert "COMPREHENSIVE DAY SCHEDULE" in SYSTEM_PROMPT
    assert "romantic" in SYSTEM_PROMPT.lower()
    assert "cost-splitting" in SYSTEM_PROMPT.lower()
    assert "safety" in SYSTEM_PROMPT.lower()


def test_build_full_itinerary_prompt():
    """Verify prompt builder formats all trip parameters, must_include, and avoid."""
    prompt = build_full_itinerary_prompt(
        destination="Kyoto, Japan",
        start_date=date(2026, 11, 1),
        end_date=date(2026, 11, 4),
        traveler_type=TravelerType.COUPLE,
        num_travelers=2,
        budget_total=Decimal("3000.00"),
        budget_level=BudgetLevel.PREMIUM,
        pace=Pace.RELAXED,
        interests=["temples", "tea ceremonies", "gardens"],
        must_include=["Fushimi Inari at dawn", "Kitcho Arashiyama"],
        avoid=["crowded bus tours", "fast food"],
    )
    assert "Kyoto, Japan" in prompt
    assert "4 full days" in prompt
    assert "couple" in prompt.lower()
    assert "$3000.00" in prompt
    assert "Fushimi Inari at dawn" in prompt
    assert "crowded bus tours" in prompt


def test_build_day_regeneration_prompt():
    """Verify day regeneration prompt contains locked items and user instruction."""
    locked = [
        {
            "type": "dining",
            "title": "Reserved Michelin Dinner",
            "start_time": "19:30:00",
            "end_time": "21:30:00",
            "estimated_cost": Decimal("200.00"),
            "location": "Gion, Kyoto",
        }
    ]
    prompt = build_day_regeneration_prompt(
        destination="Kyoto",
        day_number=2,
        day_date=date(2026, 11, 2),
        total_days=4,
        traveler_type=TravelerType.COUPLE,
        num_travelers=2,
        budget_level=BudgetLevel.PREMIUM,
        pace=Pace.BALANCED,
        daily_budget_target=Decimal("750.00"),
        instruction="more culinary focus, less walking uphill",
        locked_items=locked,
    )
    assert "Day 2" in prompt
    assert "Reserved Michelin Dinner" in prompt
    assert "more culinary focus, less walking uphill" in prompt
    assert "IMMUTABLE LOCKED ITEMS" in prompt


def test_build_item_replacement_prompt():
    """Verify item replacement prompt details target item and replacement instructions."""
    current = {
        "type": "attraction",
        "title": "Outdoor Botanical Garden",
        "description": "Walk among roses",
        "location": "Central Park",
        "start_time": "14:00:00",
        "end_time": "16:00:00",
        "estimated_cost": Decimal("15.00"),
    }
    prompt = build_item_replacement_prompt(
        destination="New York City",
        day_summary="Afternoon in Manhattan",
        current_item=current,
        instruction="Indoor activity because of heavy rain",
        budget_level=BudgetLevel.MID,
    )
    assert "Outdoor Botanical Garden" in prompt
    assert "Indoor activity because of heavy rain" in prompt
    assert "New York City" in prompt


# ==============================================================================
# 2. BUDGET GUARDRAIL & POST-CHECK TESTS
# ==============================================================================

def test_budget_guardrail_scales_overbudget_itinerary():
    """Guardrail must scale down item costs when the LLM invents a total over budget."""
    overbudget_itinerary = GeneratedItinerary(
        title="Tokyo Highlights",
        summary="Luxury visit",
        total_estimated_cost=Decimal("5000.00"),
        days=[
            GeneratedDay(
                day_number=1,
                summary="Day 1",
                estimated_cost=Decimal("2500.00"),
                items=[
                    GeneratedItem(
                        order_index=0,
                        type=ItineraryItemType.ATTRACTION,
                        title="Observation Deck",
                        estimated_cost=Decimal("500.00"),
                    ),
                    GeneratedItem(
                        order_index=1,
                        type=ItineraryItemType.DINING,
                        title="Kobe Beef Dinner",
                        estimated_cost=Decimal("2000.00"),
                    ),
                ],
            ),
            GeneratedDay(
                day_number=2,
                summary="Day 2",
                estimated_cost=Decimal("2500.00"),
                items=[
                    GeneratedItem(
                        order_index=0,
                        type=ItineraryItemType.ACTIVITY,
                        title="Helicopter Tour",
                        estimated_cost=Decimal("2500.00"),
                    ),
                ],
            ),
        ],
    )

    budget_ceiling = Decimal("2000.00")
    guarded = AIPlannerService.enforce_budget_guardrail(overbudget_itinerary, budget_ceiling)

    # Must never exceed budget
    assert guarded.total_estimated_cost <= budget_ceiling
    # Sum of days must equal total
    assert sum(d.estimated_cost for d in guarded.days) == guarded.total_estimated_cost
    # Sum of items in day 1 must equal day 1 cost
    assert sum(i.estimated_cost for i in guarded.days[0].items) == guarded.days[0].estimated_cost


def test_budget_guardrail_within_budget_untouched():
    """If model is under budget, prices remain as generated and day totals are synced."""
    itinerary = GeneratedItinerary(
        title="Budget Trip",
        summary="Hostels and transit",
        total_estimated_cost=Decimal("300.00"),
        days=[
            GeneratedDay(
                day_number=1,
                summary="Day 1",
                estimated_cost=Decimal("150.00"),
                items=[
                    GeneratedItem(
                        order_index=0,
                        type=ItineraryItemType.DINING,
                        title="Street Food",
                        estimated_cost=Decimal("30.00"),
                    ),
                    GeneratedItem(
                        order_index=1,
                        type=ItineraryItemType.ATTRACTION,
                        title="Free Museum",
                        estimated_cost=Decimal("0.00"),
                    ),
                ],
            ),
        ],
    )
    guarded = AIPlannerService.enforce_budget_guardrail(itinerary, Decimal("1000.00"))
    assert guarded.total_estimated_cost == Decimal("30.00")
    assert guarded.days[0].estimated_cost == Decimal("30.00")


# ==============================================================================
# 3. RETRY MECHANISM TESTS
# ==============================================================================

@pytest.mark.anyio
async def test_retry_on_validation_failure():
    """Model call retries when schema validation fails and succeeds on subsequent try."""
    attempts = 0

    async def mock_caller(prompt, response_model):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            # First attempt returns invalid data (negative cost violates ge=0)
            return '{"title": "Bad", "summary": "X", "total_estimated_cost": -50, "days": []}'
        return GeneratedItinerary(
            title="Recovered Itinerary",
            summary="Valid on attempt 2",
            total_estimated_cost=Decimal("500.00"),
            days=[],
        )

    service = AIPlannerService(custom_llm_caller=mock_caller)
    result = await service._call_gemini_structured("system", "prompt", GeneratedItinerary, max_retries=2)
    assert attempts == 2
    assert result.title == "Recovered Itinerary"


# ==============================================================================
# 4. FULL ITINERARY GENERATION ENDPOINT TESTS
# ==============================================================================

def test_generate_itinerary_endpoint(client: TestClient, monkeypatch):
    """POST /api/v1/trips/{id}/generate generates full itinerary and updates trip status."""
    # 1. Create a 2-day trip
    create_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Tokyo Foodie Run",
            "destination": "Tokyo, Japan",
            "start_date": "2026-10-01",
            "end_date": "2026-10-02",
            "num_travelers": 2,
            "traveler_type": "couple",
            "budget_total": "1200.00",
            "budget_level": "mid",
            "pace": "balanced",
            "interests": ["ramen", "markets"],
        },
    )
    trip_id = create_res.json()["id"]

    # 2. Mock LLM generator
    async def mock_generator(prompt, response_model):
        return GeneratedItinerary(
            title="Tokyo Foodie Run",
            summary="Ramen, sushi, and Tsukiji Outer Market",
            total_estimated_cost=Decimal("800.00"),
            days=[
                GeneratedDay(
                    day_number=1,
                    summary="Shibuya & Shinjuku Gastronomy",
                    estimated_cost=Decimal("400.00"),
                    items=[
                        GeneratedItem(
                            order_index=0,
                            type=ItineraryItemType.DINING,
                            title="Breakfast at bills Omotesando",
                            location="Omotesando",
                            start_time="08:30:00",
                            end_time="09:45:00",
                            estimated_cost=Decimal("40.00"),
                        ),
                        GeneratedItem(
                            order_index=1,
                            type=ItineraryItemType.ATTRACTION,
                            title="Meiji Jingu Stroll",
                            location="Shibuya",
                            start_time="10:00:00",
                            end_time="12:00:00",
                            estimated_cost=Decimal("0.00"),
                        ),
                    ],
                ),
                GeneratedDay(
                    day_number=2,
                    summary="Tsukiji & Ginza Exploring",
                    estimated_cost=Decimal("400.00"),
                    items=[
                        GeneratedItem(
                            order_index=0,
                            type=ItineraryItemType.DINING,
                            title="Tsukiji Outer Market Tasting",
                            location="Tsukiji",
                            start_time="09:00:00",
                            end_time="11:30:00",
                            estimated_cost=Decimal("60.00"),
                        ),
                    ],
                ),
            ],
        )

    monkeypatch.setattr(ai_planner_service, "custom_llm_caller", mock_generator)

    # 3. Call generate endpoint
    gen_res = client.post(
        f"/api/v1/trips/{trip_id}/generate",
        json={"must_include": ["Tsukiji Market"], "avoid": ["crowded buses"]},
    )
    assert gen_res.status_code == 200
    trip_data = gen_res.json()
    assert trip_data["status"] == "generated"
    assert len(trip_data["days"]) == 2
    assert len(trip_data["days"][0]["items"]) == 2
    assert trip_data["days"][0]["items"][0]["title"] == "Breakfast at bills Omotesando"
    assert len(trip_data["days"][1]["items"]) == 1


def test_generate_itinerary_forbidden_for_strangers(client: TestClient, mock_other_user):
    """Strangers cannot trigger generation on another user's trip."""
    res = client.post(
        "/api/v1/trips",
        json={
            "title": "Private Trip",
            "destination": "Honolulu",
            "start_date": "2026-11-01",
            "end_date": "2026-11-03",
        },
    )
    trip_id = res.json()["id"]

    app.dependency_overrides[get_current_user] = lambda: mock_other_user
    gen_forbidden = client.post(f"/api/v1/trips/{trip_id}/generate")
    assert gen_forbidden.status_code == 403


# ==============================================================================
# 5. DAY REGENERATION ENDPOINT TESTS
# ==============================================================================

def test_regenerate_day_preserves_locked_items(client: TestClient, monkeypatch):
    """POST /api/v1/trips/{id}/days/{day_number}/regenerate must preserve locked items."""
    # 1. Create trip
    trip_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Paris Journey",
            "destination": "Paris, France",
            "start_date": "2026-07-01",
            "end_date": "2026-07-02",
        },
    )
    trip_id = trip_res.json()["id"]
    details = client.get(f"/api/v1/trips/{trip_id}").json()
    day1_id = details["days"][0]["id"]

    # 2. Add an unlocked item and a locked item
    client.post(
        f"/api/v1/days/{day1_id}/items",
        json={
            "type": "attraction",
            "title": "Eiffel Tower",
            "is_locked": True,  # LOCKED!
            "estimated_cost": "30.00",
        },
    )
    client.post(
        f"/api/v1/days/{day1_id}/items",
        json={
            "type": "dining",
            "title": "Boring Sandwich Shop",
            "is_locked": False,  # UNLOCKED
            "estimated_cost": "15.00",
        },
    )

    # 3. Mock LLM day regeneration
    async def mock_day_generator(prompt, response_model):
        return GeneratedDay(
            day_number=1,
            summary="Artistic Left Bank & Louvre",
            estimated_cost=Decimal("80.00"),
            items=[
                GeneratedItem(
                    order_index=0,
                    type=ItineraryItemType.DINING,
                    title="Cafe de Flore Croissants",
                    location="Saint-Germain",
                    estimated_cost=Decimal("25.00"),
                ),
                GeneratedItem(
                    order_index=1,
                    type=ItineraryItemType.ATTRACTION,
                    title="Musee d'Orsay",
                    location="7th Arr.",
                    estimated_cost=Decimal("18.00"),
                ),
            ],
        )

    monkeypatch.setattr(ai_planner_service, "custom_llm_caller", mock_day_generator)

    # 4. Regenerate day 1
    regen_res = client.post(
        f"/api/v1/trips/{trip_id}/days/1/regenerate",
        json={"instruction": "more cultural museums, less fast food"},
    )
    assert regen_res.status_code == 200
    day_data = regen_res.json()
    assert day_data["summary"] == "Artistic Left Bank & Louvre"

    # Eiffel Tower (locked) must still exist!
    titles = [i["title"] for i in day_data["items"]]
    assert "Eiffel Tower" in titles
    # "Boring Sandwich Shop" (unlocked) must have been replaced
    assert "Boring Sandwich Shop" not in titles
    assert "Cafe de Flore Croissants" in titles


# ==============================================================================
# 6. ITEM REPLACEMENT ENDPOINT TESTS
# ==============================================================================

def test_replace_item_endpoint(client: TestClient, monkeypatch):
    """POST /api/v1/items/{id}/replace replaces a single activity with an alternative."""
    # 1. Create trip & item
    trip_res = client.post(
        "/api/v1/trips",
        json={
            "title": "London Trip",
            "destination": "London, UK",
            "start_date": "2026-08-01",
            "end_date": "2026-08-02",
        },
    )
    trip_id = trip_res.json()["id"]
    details = client.get(f"/api/v1/trips/{trip_id}").json()
    day_id = details["days"][0]["id"]

    item_res = client.post(
        f"/api/v1/days/{day_id}/items",
        json={
            "type": "attraction",
            "title": "Open-air Rooftop Cinema",
            "start_time": "19:00:00",
            "end_time": "21:30:00",
            "estimated_cost": "25.00",
        },
    )
    item_id = item_res.json()["id"]

    # 2. Mock LLM replacement
    async def mock_item_replacer(prompt, response_model):
        return GeneratedItemReplacement(
            type=ItineraryItemType.ATTRACTION,
            title="The Globe Theatre Indoor Playhouse",
            description="Intimate candlelit performance out of the rain",
            location="Bankside, Southwark",
            start_time="19:00:00",
            end_time="21:30:00",
            estimated_cost=Decimal("35.00"),
            reason="Indoor, atmospheric, directly accessible by tube",
        )

    monkeypatch.setattr(ai_planner_service, "custom_llm_caller", mock_item_replacer)

    # 3. Call replace endpoint
    rep_res = client.post(
        f"/api/v1/items/{item_id}/replace",
        json={"instruction": "Heavy rain forecast, need indoor alternative"},
    )
    assert rep_res.status_code == 200
    replaced = rep_res.json()
    assert replaced["title"] == "The Globe Theatre Indoor Playhouse"
    assert float(replaced["estimated_cost"]) == 35.0
    assert "Indoor" in replaced["notes"]


# ==============================================================================
# 7. OPENAPI ACCURACY FOR AI ENDPOINTS
# ==============================================================================

def test_ai_endpoints_openapi_accuracy(client: TestClient):
    """Verify that all AI generation and replacement routes are documented in OpenAPI."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    paths = schema["paths"]

    assert "/api/v1/trips/{id}/generate" in paths
    assert "post" in paths["/api/v1/trips/{id}/generate"]

    assert "/api/v1/trips/{id}/days/{day_number}/regenerate" in paths
    assert "post" in paths["/api/v1/trips/{id}/days/{day_number}/regenerate"]

    assert "/api/v1/items/{id}/replace" in paths
    assert "post" in paths["/api/v1/items/{id}/replace"]
