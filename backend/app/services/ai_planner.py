import json
import logging
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional
from uuid import UUID
import httpx
from pydantic import ValidationError

from app.core.config import settings
from app.core.rate_limiter import ai_rate_limiter
from app.services.ai_fallback import (
    generate_fallback_itinerary,
    generate_fallback_day,
    generate_fallback_replacement,
)
from app.schemas.ai import (
    GeneratedItinerary,
    GeneratedDay,
    GeneratedItem,
    GeneratedItemReplacement,
    GenerateItineraryRequest,
    RegenerateDayRequest,
    ReplaceItemRequest,
)
from app.schemas.itinerary import (
    ItineraryDayWithItemsResponse,
    ItineraryItemCreate,
    ItineraryItemResponse,
    TripWithDetailsResponse,
)
from app.schemas.trip import TripResponse, TripStatus
from app.services.prompts import (
    SYSTEM_PROMPT,
    build_full_itinerary_prompt,
    build_day_regeneration_prompt,
    build_item_replacement_prompt,
)
from app.repositories.base import NotFoundError, ForbiddenError, RepositoryError
from app.repositories.trip_repo import trip_repository, TripRepository
from app.repositories.itinerary_repo import itinerary_repository, ItineraryRepository
from app.repositories.data_store import data_store

logger = logging.getLogger("ai.planner")


class AIPlannerService:
    """Service handling generative travel planning with Gemini structured outputs,
    robust retry validation, and strict budget guardrails.
    """

    def __init__(
        self,
        trip_repo: TripRepository = trip_repository,
        itinerary_repo: ItineraryRepository = itinerary_repository,
        custom_llm_caller: Optional[Callable] = None,
    ):
        self.trip_repo = trip_repo
        self.itinerary_repo = itinerary_repo
        self.custom_llm_caller = custom_llm_caller

    # --------------------------------------------------------------------------
    # Budget Guardrail
    # --------------------------------------------------------------------------
    @staticmethod
    def enforce_budget_guardrail(
        itinerary: GeneratedItinerary,
        budget_total: Optional[Decimal],
    ) -> GeneratedItinerary:
        """Post-check guardrail: ensures total estimated costs never exceed the user's budget,
        proportionally adjusting flexible items and syncing all day totals.
        """
        # First sync day totals with item sums
        for day in itinerary.days:
            day.estimated_cost = round(float(sum(float(item.estimated_cost) for item in day.items)), 2)
        raw_total = round(float(sum(float(day.estimated_cost) for day in itinerary.days)), 2)

        if budget_total is not None and float(budget_total) > 0 and raw_total > float(budget_total):
            # Scale non-zero items down proportionally
            b_total = float(budget_total)
            scale = b_total / raw_total
            running_cost = 0.0
            all_items = [i for d in itinerary.days for i in d.items]

            for idx, item in enumerate(all_items):
                if idx == len(all_items) - 1:
                    # Final item absorbs remainder to guarantee exact ceiling
                    item.estimated_cost = round(max(0.0, b_total - running_cost), 2)
                else:
                    scaled = round(float(item.estimated_cost) * scale, 2)
                    item.estimated_cost = scaled
                    running_cost += scaled

            for day in itinerary.days:
                day.estimated_cost = round(float(sum(float(item.estimated_cost) for item in day.items)), 2)
            itinerary.total_estimated_cost = round(float(sum(float(day.estimated_cost) for day in itinerary.days)), 2)
        else:
            itinerary.total_estimated_cost = raw_total

        return itinerary

    # --------------------------------------------------------------------------
    # Gemini LLM Calling & Retry Mechanism
    # --------------------------------------------------------------------------
    async def _call_gemini_structured(
        self,
        system_instruction: str,
        user_prompt: str,
        response_model: Any,
        max_retries: int = 2,
    ) -> Any:
        """Call Gemini API with structured output and retry up to max_retries on schema failure."""
        api_key = settings.GEMINI_API_KEY
        model = settings.GEMINI_MODEL or "gemini-2.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        messages = [
            {"role": "user", "parts": [{"text": user_prompt}]}
        ]
        json_schema = response_model.model_json_schema()

        last_error = None
        for attempt in range(max_retries + 1):
            if self.custom_llm_caller:
                try:
                    raw_result = await self.custom_llm_caller(user_prompt, response_model)
                    if isinstance(raw_result, str):
                        return response_model.model_validate_json(raw_result)
                    elif isinstance(raw_result, dict):
                        return response_model.model_validate(raw_result)
                    return raw_result
                except (ValidationError, json.JSONDecodeError, KeyError) as e:
                    last_error = str(e)
                    if attempt < max_retries:
                        continue
                    raise RepositoryError(
                        f"Failed to generate valid output after {max_retries + 1} attempts: {last_error}",
                        status_code=422,
                    )

            if not api_key or "your-gemini" in api_key:
                raise RepositoryError(
                    "Gemini API key is not configured. Please set GEMINI_API_KEY in .env.",
                    status_code=503,
                )

            request_body = {
                "systemInstruction": {"parts": [{"text": system_instruction}]},
                "contents": messages,
                "generationConfig": {
                    "temperature": 0.4,
                    "responseMimeType": "application/json",
                    "responseSchema": json_schema,
                },
            }

            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    resp = await client.post(url, json=request_body)
                    if resp.status_code != 200:
                        raise RepositoryError(f"Gemini API error ({resp.status_code}): {resp.text}", status_code=502)
                    data = resp.json()

                candidates = data.get("candidates", [])
                if not candidates:
                    raise RepositoryError("No response candidates returned by Gemini model", status_code=502)

                text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                validated_model = response_model.model_validate_json(text_content)
                return validated_model

            except (ValidationError, json.JSONDecodeError, KeyError) as e:
                last_error = str(e)
                if attempt < max_retries:
                    # Feed validation failure back to the conversation for self-correction
                    messages.append(
                        {"role": "model", "parts": [{"text": text_content if 'text_content' in locals() else "{}"}]}
                    )
                    messages.append(
                        {
                            "role": "user",
                            "parts": [
                                {
                                    "text": f"The response was invalid and failed schema validation: {last_error}. "
                                    f"Please correct the errors and return clean JSON strictly matching the schema."
                                }
                            ],
                        }
                    )
                else:
                    raise RepositoryError(
                        f"Failed to generate valid itinerary after {max_retries + 1} attempts: {last_error}",
                        status_code=422,
                    )
            except Exception as e:
                raise RepositoryError(f"Gemini generation call failed: {str(e)}", status_code=502)

    # --------------------------------------------------------------------------
    # 1. Full Trip Generation (POST /trips/{id}/generate)
    # --------------------------------------------------------------------------
    async def generate_trip_itinerary(
        self,
        trip_id: UUID,
        user_id: UUID,
        request: Optional[GenerateItineraryRequest] = None,
        token: Optional[str] = None,
    ) -> TripWithDetailsResponse:
        """Generate a complete multi-day itinerary and persist all days and items."""
        trip_details = await self.trip_repo.get_trip(trip_id=trip_id, user_id=user_id, token=token)
        if not self.trip_repo.store.can_edit_trip(trip_id, user_id):
            raise ForbiddenError("You do not have permission to generate this itinerary")

        req = request or GenerateItineraryRequest()

        # Merge group preferences and item voting feedback if present
        group_prefs = self.trip_repo.store.get_group_preferences(trip_id, user_id)
        effective_interests = group_prefs.merged_interests if group_prefs.preferences else trip_details.interests
        effective_budget = group_prefs.effective_budget_cap or trip_details.budget_total

        must_include_list = list(req.must_include or [])
        avoid_list = list(req.avoid or [])

        if group_prefs.conflicts:
            must_include_list.append(f"Balance group preferences: {'; '.join(group_prefs.conflicts)}")

        for day in trip_details.days:
            for item in day.items:
                if getattr(item, "score", 0) > 0 and item.title not in must_include_list:
                    must_include_list.append(f"Keep popular group favorite: {item.title}")
                elif getattr(item, "score", 0) < 0 and item.title not in avoid_list:
                    avoid_list.append(f"Replace downvoted activity: {item.title}")

        user_prompt = build_full_itinerary_prompt(
            destination=trip_details.destination,
            start_date=trip_details.start_date,
            end_date=trip_details.end_date,
            traveler_type=trip_details.traveler_type,
            num_travelers=trip_details.num_travelers,
            budget_total=effective_budget,
            budget_level=trip_details.budget_level,
            pace=trip_details.pace,
            interests=effective_interests,
            accommodation_pref=trip_details.accommodation_pref,
            transport_pref=trip_details.transport_pref,
            must_include=must_include_list,
            avoid=avoid_list,
        )

        try:
            generated_raw = await self._call_gemini_structured(
                system_instruction=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                response_model=GeneratedItinerary,
            )
        except Exception as e:
            if self.custom_llm_caller:
                raise
            logger.warning(f"LLM full generation failed ({e}); invoking graceful fallback generator.")
            generated_raw = generate_fallback_itinerary(
                destination=trip_details.destination,
                start_date=trip_details.start_date,
                end_date=trip_details.end_date,
                traveler_type=trip_details.traveler_type,
                num_travelers=trip_details.num_travelers,
                budget_total=effective_budget,
                budget_level=trip_details.budget_level,
                pace=trip_details.pace,
                interests=effective_interests,
            )

        ai_rate_limiter.record_usage(str(user_id))

        # Apply budget guardrail
        guarded_itinerary = self.enforce_budget_guardrail(generated_raw, trip_details.budget_total)

        # Persist generated days and items to database / repository
        existing_days = {d.day_number: d for d in trip_details.days}

        for gen_day in guarded_itinerary.days:
            target_day = existing_days.get(gen_day.day_number)
            if not target_day:
                continue

            day_id = target_day.id

            # Clear existing non-locked items if any
            existing_items = [
                i for i in data_store.itinerary_items.values() if i["day_id"] == day_id
            ]
            for it in existing_items:
                if not it.get("is_locked"):
                    data_store.itinerary_items.pop(it["id"], None)

            # Update day summary
            if day_id in data_store.itinerary_days:
                data_store.itinerary_days[day_id]["summary"] = gen_day.summary

            # Insert newly generated items
            for idx, gen_item in enumerate(gen_day.items):
                item_payload = ItineraryItemCreate(
                    day_id=day_id,
                    order_index=idx,
                    type=gen_item.type,
                    title=gen_item.title,
                    description=gen_item.description,
                    location=gen_item.location,
                    start_time=gen_item.start_time,
                    end_time=gen_item.end_time,
                    estimated_cost=gen_item.estimated_cost,
                    notes=gen_item.notes,
                )
                await self.itinerary_repo.create_item(
                    day_id=day_id,
                    item_data=item_payload,
                    user_id=user_id,
                    token=token,
                )

        # Update trip status to 'generated'
        if trip_id in data_store.trips:
            data_store.trips[trip_id]["status"] = TripStatus.GENERATED

        # Return updated complete trip
        return await self.trip_repo.get_trip(trip_id=trip_id, user_id=user_id, token=token)

    # --------------------------------------------------------------------------
    # 2. Single Day Regeneration (POST /trips/{id}/days/{day_number}/regenerate)
    # --------------------------------------------------------------------------
    async def regenerate_day(
        self,
        trip_id: UUID,
        day_number: int,
        user_id: UUID,
        request: Optional[RegenerateDayRequest] = None,
        token: Optional[str] = None,
    ) -> ItineraryDayWithItemsResponse:
        """Regenerate a single day schedule, keeping locked items intact."""
        trip_details = await self.trip_repo.get_trip(trip_id=trip_id, user_id=user_id, token=token)
        if not self.trip_repo.store.can_edit_trip(trip_id, user_id):
            raise ForbiddenError("You do not have permission to edit this trip")

        target_day = next((d for d in trip_details.days if d.day_number == day_number), None)
        if not target_day:
            raise NotFoundError(f"Day {day_number} does not exist in trip '{trip_id}'")

        req = request or RegenerateDayRequest()
        day_id = target_day.id

        # Retrieve locked and unlocked items
        locked_items = [i.model_dump() for i in target_day.items if i.is_locked]
        total_days = len(trip_details.days)
        daily_target = (
            trip_details.budget_total / Decimal(total_days)
            if trip_details.budget_total
            else None
        )

        must_include_day = list(req.must_include or [])
        avoid_day = list(req.avoid or [])

        for item in target_day.items:
            if getattr(item, "score", 0) > 0 and item.title not in must_include_day:
                must_include_day.append(f"Keep favorite: {item.title}")
            elif getattr(item, "score", 0) < 0 and item.title not in avoid_day:
                avoid_day.append(f"Replace downvoted: {item.title}")

        user_prompt = build_day_regeneration_prompt(
            destination=trip_details.destination,
            day_number=day_number,
            day_date=target_day.date,
            total_days=total_days,
            traveler_type=trip_details.traveler_type,
            num_travelers=trip_details.num_travelers,
            budget_level=trip_details.budget_level,
            pace=trip_details.pace,
            daily_budget_target=daily_target,
            instruction=req.instruction,
            locked_items=locked_items,
            must_include=must_include_day,
            avoid=avoid_day,
        )

        try:
            gen_day: GeneratedDay = await self._call_gemini_structured(
                system_instruction=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                response_model=GeneratedDay,
            )
        except Exception as e:
            if self.custom_llm_caller:
                raise
            logger.warning(f"LLM day regeneration failed ({e}); invoking graceful fallback generator.")
            gen_day = generate_fallback_day(
                destination=trip_details.destination,
                day_number=day_number,
                day_date=target_day.date,
                budget_level=trip_details.budget_level,
                pace=trip_details.pace,
            )

        ai_rate_limiter.record_usage(str(user_id))

        # Clear only unlocked items on this day
        existing_items = [i for i in data_store.itinerary_items.values() if i["day_id"] == day_id]
        for it in existing_items:
            if not it.get("is_locked"):
                data_store.itinerary_items.pop(it["id"], None)

        # Update day summary
        if day_id in data_store.itinerary_days:
            data_store.itinerary_days[day_id]["summary"] = gen_day.summary

        # Merge newly generated items (avoiding duplicates of locked items)
        locked_titles = {item["title"].strip().lower() for item in locked_items}
        current_idx = 0
        for item in gen_day.items:
            if item.title.strip().lower() in locked_titles:
                continue
            item_payload = ItineraryItemCreate(
                day_id=day_id,
                order_index=current_idx,
                type=item.type,
                title=item.title,
                description=item.description,
                location=item.location,
                start_time=item.start_time,
                end_time=item.end_time,
                estimated_cost=item.estimated_cost,
                notes=item.notes,
            )
            await self.itinerary_repo.create_item(
                day_id=day_id,
                item_data=item_payload,
                user_id=user_id,
                token=token,
            )
            current_idx += 1

        # Fetch updated day with items
        updated_trip = await self.trip_repo.get_trip(trip_id=trip_id, user_id=user_id, token=token)
        updated_day = next((d for d in updated_trip.days if d.id == day_id), None)
        return updated_day

    # --------------------------------------------------------------------------
    # 3. Single Activity Replacement (POST /items/{id}/replace)
    # --------------------------------------------------------------------------
    async def replace_activity(
        self,
        item_id: UUID,
        user_id: UUID,
        request: Optional[ReplaceItemRequest] = None,
        token: Optional[str] = None,
    ) -> ItineraryItemResponse:
        """Suggest an alternative for a single activity and update it in place."""
        item = data_store.itinerary_items.get(item_id)
        if not item:
            raise NotFoundError(f"Itinerary item with id '{item_id}' not found")

        day = data_store.itinerary_days.get(item["day_id"])
        if not day or not data_store.can_edit_trip(day["trip_id"], user_id):
            raise ForbiddenError("You do not have permission to edit this itinerary item")

        trip = data_store.trips.get(day["trip_id"])
        destination = trip.get("destination", "the destination") if trip else "the city"
        budget_level = trip.get("budget_level") if trip else "mid"

        req = request or ReplaceItemRequest()
        user_prompt = build_item_replacement_prompt(
            destination=destination,
            day_summary=day.get("summary"),
            current_item=item,
            instruction=req.instruction or req.preference,
            budget_level=budget_level,
        )

        try:
            replacement: GeneratedItemReplacement = await self._call_gemini_structured(
                system_instruction=SYSTEM_PROMPT,
                user_prompt=user_prompt,
                response_model=GeneratedItemReplacement,
            )
        except Exception as e:
            if self.custom_llm_caller:
                raise
            logger.warning(f"LLM item replacement failed ({e}); invoking graceful fallback generator.")
            replacement = generate_fallback_replacement(
                item_title=item.get("title", "Activity"),
                item_type=item.get("type", "activity"),
            )

        ai_rate_limiter.record_usage(str(user_id))

        # Update existing item in place
        from app.schemas.itinerary import ItineraryItemUpdate
        update_payload = ItineraryItemUpdate(
            type=replacement.type,
            title=replacement.title,
            description=replacement.description,
            location=replacement.location or item.get("location"),
            start_time=replacement.start_time or item.get("start_time"),
            end_time=replacement.end_time or item.get("end_time"),
            estimated_cost=replacement.estimated_cost,
            notes=replacement.notes or (f"Replaced activity: {replacement.reason}" if replacement.reason else None),
        )

        return await self.itinerary_repo.update_item(
            item_id=item_id,
            item_update=update_payload,
            user_id=user_id,
            token=token,
        )


ai_planner_service = AIPlannerService()
