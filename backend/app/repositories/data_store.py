from datetime import datetime, timezone, date, time
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from app.schemas.profile import ProfileResponse
from app.schemas.trip import (
    TripResponse,
    TripCreate,
    TripUpdate,
    TripStatus,
)
from app.schemas.trip_member import (
    TripMemberResponse,
    TripRole,
    MemberPreferenceCreate,
    MemberPreferenceResponse,
    GroupPreferencesSummaryResponse,
)
from app.schemas.itinerary import (
    ItineraryDayResponse,
    ItineraryDayWithItemsResponse,
    ItineraryItemResponse,
    ItineraryItemCreate,
    ItineraryItemUpdate,
    TripWithDetailsResponse,
    ItemVoteRequest,
    ItemVoteSummary,
)
from app.repositories.base import (
    NotFoundError,
    ForbiddenError,
    ConflictError,
)


class InMemoryDataStore:
    """Thread-safe in-memory database store with foreign-key cascade & RLS checks.
    Provides complete offline, fast test, and dev execution matching Supabase Postgres schema.
    """

    def __init__(self):
        self.reset()

    def reset(self):
        """Clear all stored entities. Useful for test isolation."""
        self.profiles: Dict[UUID, Dict] = {}
        self.trips: Dict[UUID, Dict] = {}
        self.trip_members: Dict[str, Dict] = {}  # key: f"{trip_id}:{user_id}"
        self.itinerary_days: Dict[UUID, Dict] = {}
        self.itinerary_items: Dict[UUID, Dict] = {}
        self.item_votes: Dict[str, Dict] = {}  # key: f"{item_id}:{user_id}"
        self.member_preferences: Dict[str, Dict] = {}  # key: f"{trip_id}:{user_id}"

    def get_or_create_profile(self, user_id: UUID, email: Optional[str] = None, full_name: Optional[str] = None) -> Dict:
        if user_id not in self.profiles:
            now = datetime.now(timezone.utc)
            self.profiles[user_id] = {
                "id": user_id,
                "full_name": full_name or (email.split("@")[0] if email else "Traveler"),
                "avatar_url": None,
                "default_currency": "USD",
                "created_at": now,
                "updated_at": now,
            }
        return self.profiles[user_id]

    def find_profile_by_email(self, email: str) -> Optional[Dict]:
        normalized = email.strip().lower()
        for p in self.profiles.values():
            p_email = p.get("email") or ""
            if p_email.strip().lower() == normalized:
                return p
        return None

    # --- Authorization checks ---
    def can_view_trip(self, trip_id: UUID, user_id: UUID) -> bool:
        trip = self.trips.get(trip_id)
        if not trip:
            return False
        if trip["owner_id"] == user_id:
            return True
        key = f"{trip_id}:{user_id}"
        return key in self.trip_members

    def can_edit_trip(self, trip_id: UUID, user_id: UUID) -> bool:
        trip = self.trips.get(trip_id)
        if not trip:
            return False
        if trip["owner_id"] == user_id:
            return True
        key = f"{trip_id}:{user_id}"
        member = self.trip_members.get(key)
        return bool(member and member["role"] in (TripRole.OWNER, TripRole.EDITOR, "owner", "editor"))

    def is_trip_owner(self, trip_id: UUID, user_id: UUID) -> bool:
        trip = self.trips.get(trip_id)
        if not trip:
            return False
        return trip["owner_id"] == user_id

    # --- Trip Operations ---
    def create_trip(self, trip_data: TripCreate, owner_id: UUID, user_email: Optional[str] = None) -> TripResponse:
        self.get_or_create_profile(owner_id, email=user_email)
        now = datetime.now(timezone.utc)
        trip_id = uuid4()
        
        trip_dict = {
            "id": trip_id,
            "owner_id": owner_id,
            "title": trip_data.title,
            "destination": trip_data.destination,
            "start_date": trip_data.start_date,
            "end_date": trip_data.end_date,
            "num_travelers": trip_data.num_travelers,
            "traveler_type": trip_data.traveler_type,
            "budget_total": trip_data.budget_total,
            "budget_level": trip_data.budget_level,
            "pace": trip_data.pace,
            "interests": list(trip_data.interests),
            "accommodation_pref": trip_data.accommodation_pref,
            "transport_pref": trip_data.transport_pref,
            "status": trip_data.status or TripStatus.DRAFT,
            "created_at": now,
            "updated_at": now,
        }
        self.trips[trip_id] = trip_dict

        # Auto-add creator as owner in trip_members (trigger handle_new_trip_owner)
        member_key = f"{trip_id}:{owner_id}"
        self.trip_members[member_key] = {
            "trip_id": trip_id,
            "user_id": owner_id,
            "role": TripRole.OWNER,
            "joined_at": now,
        }

        # Auto-create itinerary days for the date range
        start = trip_data.start_date
        end = trip_data.end_date
        total_days = (end - start).days + 1
        for i in range(total_days):
            day_id = uuid4()
            current_date = date.fromordinal(start.toordinal() + i)
            self.itinerary_days[day_id] = {
                "id": day_id,
                "trip_id": trip_id,
                "day_number": i + 1,
                "date": current_date,
                "summary": None,
                "estimated_cost": 0.0,
                "version": 1,
                "created_at": now,
                "updated_at": now,
            }

        return TripResponse(**trip_dict)

    def list_trips(self, user_id: UUID) -> List[TripResponse]:
        accessible_trips = []
        for trip_id, trip in self.trips.items():
            if self.can_view_trip(trip_id, user_id):
                accessible_trips.append(TripResponse(**trip))
        accessible_trips.sort(key=lambda t: t.created_at, reverse=True)
        return accessible_trips

    def get_trip(self, trip_id: UUID, user_id: UUID) -> TripWithDetailsResponse:
        trip = self.trips.get(trip_id)
        if not trip:
            raise NotFoundError(f"Trip with id '{trip_id}' not found")
        if not self.can_view_trip(trip_id, user_id):
            raise ForbiddenError("You do not have access to view this trip")

        # Owner profile
        owner_dict = self.profiles.get(trip["owner_id"])
        owner_profile = ProfileResponse(**owner_dict) if owner_dict else None

        # Members
        members_list = []
        for m_key, member in self.trip_members.items():
            if member["trip_id"] == trip_id:
                m_prof = self.profiles.get(member["user_id"])
                members_list.append(
                    TripMemberResponse(
                        trip_id=trip_id,
                        user_id=member["user_id"],
                        role=member["role"],
                        joined_at=member["joined_at"],
                        profile=ProfileResponse(**m_prof) if m_prof else None,
                    )
                )

        # Days with nested Items
        days_list = []
        trip_days = [d for d in self.itinerary_days.values() if d["trip_id"] == trip_id]
        trip_days.sort(key=lambda d: d["day_number"])

        for d in trip_days:
            day_items = []
            for it in self.itinerary_items.values():
                if it["day_id"] == d["id"]:
                    vote_info = self.get_item_votes(it["id"], user_id)
                    day_items.append(ItineraryItemResponse(**it, **vote_info))
            day_items.sort(key=lambda it: it.order_index)
            calc_day_cost = float(sum(float(it.estimated_cost) for it in day_items)) if day_items else float(d.get("estimated_cost") or 0.0)
            d["estimated_cost"] = calc_day_cost
            days_list.append(
                ItineraryDayWithItemsResponse(
                    id=d["id"],
                    trip_id=d["trip_id"],
                    day_number=d["day_number"],
                    date=d["date"],
                    summary=d["summary"],
                    estimated_cost=calc_day_cost,
                    version=d["version"],
                    created_at=d["created_at"],
                    updated_at=d["updated_at"],
                    items=day_items,
                )
            )

        return TripWithDetailsResponse(
            **trip,
            owner=owner_profile,
            members=members_list,
            days=days_list,
        )

    def update_trip(self, trip_id: UUID, user_id: UUID, trip_update: TripUpdate) -> TripResponse:
        trip = self.trips.get(trip_id)
        if not trip:
            raise NotFoundError(f"Trip with id '{trip_id}' not found")
        if not self.can_edit_trip(trip_id, user_id):
            raise ForbiddenError("You do not have permission to update this trip")

        update_dict = trip_update.model_dump(exclude_unset=True)
        now = datetime.now(timezone.utc)
        for k, v in update_dict.items():
            if v is not None:
                trip[k] = v
        trip["updated_at"] = now
        return TripResponse(**trip)

    def delete_trip(self, trip_id: UUID, user_id: UUID) -> bool:
        trip = self.trips.get(trip_id)
        if not trip:
            raise NotFoundError(f"Trip with id '{trip_id}' not found")
        if not self.is_trip_owner(trip_id, user_id):
            raise ForbiddenError("Only the trip owner can delete this trip")

        # Cascade delete days and items
        day_ids_to_del = [d["id"] for d in self.itinerary_days.values() if d["trip_id"] == trip_id]
        for did in day_ids_to_del:
            item_ids_to_del = [i["id"] for i in self.itinerary_items.values() if i["day_id"] == did]
            for iid in item_ids_to_del:
                self.itinerary_items.pop(iid, None)
            self.itinerary_days.pop(did, None)

        # Cascade delete members
        keys_to_del = [k for k, m in self.trip_members.items() if m["trip_id"] == trip_id]
        for k in keys_to_del:
            self.trip_members.pop(k, None)

        self.trips.pop(trip_id, None)
        return True

    # --- Itinerary Day & Item Operations ---
    def create_item(self, day_id: UUID, item_data: ItineraryItemCreate, user_id: UUID) -> ItineraryItemResponse:
        day = self.itinerary_days.get(day_id)
        if not day:
            raise NotFoundError(f"Itinerary day with id '{day_id}' not found")
        if not self.can_edit_trip(day["trip_id"], user_id):
            raise ForbiddenError("You do not have permission to add items to this itinerary")

        existing_items = [i for i in self.itinerary_items.values() if i["day_id"] == day_id]
        order_index = item_data.order_index
        if order_index == 0 and existing_items:
            max_idx = max(i["order_index"] for i in existing_items)
            order_index = max_idx + 1

        item_id = uuid4()
        now = datetime.now(timezone.utc)
        item_dict = {
            "id": item_id,
            "day_id": day_id,
            "order_index": order_index,
            "type": item_data.type,
            "title": item_data.title,
            "description": item_data.description,
            "location": item_data.location,
            "start_time": item_data.start_time,
            "end_time": item_data.end_time,
            "estimated_cost": float(item_data.estimated_cost or 0.0),
            "notes": item_data.notes,
            "is_locked": item_data.is_locked,
            "created_at": now,
            "updated_at": now,
        }
        self.itinerary_items[item_id] = item_dict

        # Recalculate estimated cost of the day
        day_total = float(sum(float(i.get("estimated_cost", 0.0)) for i in self.itinerary_items.values() if i["day_id"] == day_id))
        day["estimated_cost"] = day_total
        day["updated_at"] = now

        return ItineraryItemResponse(**item_dict)

    def update_item(self, item_id: UUID, item_update: ItineraryItemUpdate, user_id: UUID) -> ItineraryItemResponse:
        item = self.itinerary_items.get(item_id)
        if not item:
            raise NotFoundError(f"Itinerary item with id '{item_id}' not found")
        day = self.itinerary_days.get(item["day_id"])
        if not day or not self.can_edit_trip(day["trip_id"], user_id):
            raise ForbiddenError("You do not have permission to update this itinerary item")

        update_dict = item_update.model_dump(exclude_unset=True)
        now = datetime.now(timezone.utc)
        for k, v in update_dict.items():
            if v is not None:
                item[k] = float(v) if k == "estimated_cost" else v
        item["updated_at"] = now

        # Update day estimated cost
        day_total = float(sum(float(i.get("estimated_cost", 0.0)) for i in self.itinerary_items.values() if i["day_id"] == day["id"]))
        day["estimated_cost"] = day_total
        day["updated_at"] = now

        return ItineraryItemResponse(**item)

    def delete_item(self, item_id: UUID, user_id: UUID) -> bool:
        item = self.itinerary_items.get(item_id)
        if not item:
            raise NotFoundError(f"Itinerary item with id '{item_id}' not found")
        day = self.itinerary_days.get(item["day_id"])
        if not day or not self.can_edit_trip(day["trip_id"], user_id):
            raise ForbiddenError("You do not have permission to delete this itinerary item")

        day_id = item["day_id"]
        self.itinerary_items.pop(item_id, None)

        # Update day estimated cost
        now = datetime.now(timezone.utc)
        day_total = float(sum(float(i.get("estimated_cost", 0.0)) for i in self.itinerary_items.values() if i["day_id"] == day_id))
        day["estimated_cost"] = day_total
        day["updated_at"] = now
        return True

    def reorder_items(self, day_id: UUID, item_orders: List[Dict], user_id: UUID) -> List[ItineraryItemResponse]:
        day = self.itinerary_days.get(day_id)
        if not day:
            raise NotFoundError(f"Itinerary day with id '{day_id}' not found")
        if not self.can_edit_trip(day["trip_id"], user_id):
            raise ForbiddenError("You do not have permission to reorder items for this trip")

        now = datetime.now(timezone.utc)
        for entry in item_orders:
            iid = entry["id"]
            idx = entry["order_index"]
            item = self.itinerary_items.get(iid)
            if item and item["day_id"] == day_id:
                item["order_index"] = idx
                item["updated_at"] = now

        day_items = [
            ItineraryItemResponse(**i)
            for i in self.itinerary_items.values()
            if i["day_id"] == day_id
        ]
        day_items.sort(key=lambda i: i.order_index)
        return day_items

    # --- Member Operations ---
    def list_members(self, trip_id: UUID, user_id: UUID) -> List[TripMemberResponse]:
        trip = self.trips.get(trip_id)
        if not trip:
            raise NotFoundError(f"Trip with id '{trip_id}' not found")
        if not self.can_view_trip(trip_id, user_id):
            raise ForbiddenError("You do not have access to view this trip's members")

        members = []
        for m in self.trip_members.values():
            if m["trip_id"] == trip_id:
                prof_dict = self.profiles.get(m["user_id"])
                members.append(
                    TripMemberResponse(
                        trip_id=trip_id,
                        user_id=m["user_id"],
                        role=m["role"],
                        joined_at=m["joined_at"],
                        profile=ProfileResponse(**prof_dict) if prof_dict else None,
                    )
                )
        return members

    def invite_member(self, trip_id: UUID, email: str, role: TripRole, inviter_id: UUID) -> TripMemberResponse:
        trip = self.trips.get(trip_id)
        if not trip:
            raise NotFoundError(f"Trip with id '{trip_id}' not found")
        if not self.is_trip_owner(trip_id, inviter_id):
            raise ForbiddenError("Only the trip owner can invite members")

        # Find or create profile for invited email
        clean_email = email.strip().lower()
        existing_profile = None
        for pid, p in self.profiles.items():
            if p.get("email") == clean_email:
                existing_profile = p
                break

        if existing_profile:
            invited_user_id = existing_profile["id"]
        else:
            invited_user_id = uuid4()
            now = datetime.now(timezone.utc)
            existing_profile = {
                "id": invited_user_id,
                "email": clean_email,
                "full_name": clean_email.split("@")[0].title(),
                "avatar_url": None,
                "default_currency": "USD",
                "created_at": now,
                "updated_at": now,
            }
            self.profiles[invited_user_id] = existing_profile

        # Check conflict
        member_key = f"{trip_id}:{invited_user_id}"
        if member_key in self.trip_members:
            raise ConflictError(f"User with email '{email}' is already a member of this trip")

        now = datetime.now(timezone.utc)
        self.trip_members[member_key] = {
            "trip_id": trip_id,
            "user_id": invited_user_id,
            "role": role,
            "joined_at": now,
        }

        return TripMemberResponse(
            trip_id=trip_id,
            user_id=invited_user_id,
            role=role,
            joined_at=now,
            profile=ProfileResponse(**existing_profile),
        )

    # --- Activity Item Voting Operations ---
    def get_item_votes(self, item_id: UUID, user_id: Optional[UUID] = None) -> Dict:
        upvotes = 0
        downvotes = 0
        user_vote = None
        for v in self.item_votes.values():
            if v["item_id"] == item_id:
                if v["vote"] == 1:
                    upvotes += 1
                elif v["vote"] == -1:
                    downvotes += 1
                if user_id and v["user_id"] == user_id:
                    user_vote = v["vote"]
        return {
            "upvotes": upvotes,
            "downvotes": downvotes,
            "score": upvotes - downvotes,
            "user_vote": user_vote,
        }

    def vote_item(self, item_id: UUID, user_id: UUID, vote: int) -> ItemVoteSummary:
        item = self.itinerary_items.get(item_id)
        if not item:
            raise NotFoundError(f"Itinerary item with id '{item_id}' not found")
        day = self.itinerary_days.get(item["day_id"])
        if not day or not self.can_view_trip(day["trip_id"], user_id):
            raise ForbiddenError("You do not have access to vote on this activity")

        key = f"{item_id}:{user_id}"
        if vote == 0:
            self.item_votes.pop(key, None)
        else:
            self.item_votes[key] = {
                "item_id": item_id,
                "user_id": user_id,
                "vote": 1 if vote > 0 else -1,
                "created_at": datetime.now(timezone.utc),
            }

        votes = self.get_item_votes(item_id, user_id)
        return ItemVoteSummary(item_id=item_id, **votes)

    def remove_member(self, trip_id: UUID, member_user_id: UUID, actor_id: UUID) -> bool:
        trip = self.trips.get(trip_id)
        if not trip:
            raise NotFoundError(f"Trip with id '{trip_id}' not found")

        member_key = f"{trip_id}:{member_user_id}"
        if member_key not in self.trip_members:
            raise NotFoundError("User is not a member of this trip")

        if member_user_id == trip["owner_id"]:
            raise ForbiddenError("Trip owner cannot be removed from the trip")

        # Must be owner or member leaving themselves
        if actor_id != member_user_id and not self.is_trip_owner(trip_id, actor_id):
            raise ForbiddenError("Only the trip owner can remove members, or members can leave on their own")

        self.trip_members.pop(member_key, None)
        self.member_preferences.pop(member_key, None)
        return True

    # --- Group Preferences Operations ---
    def save_member_preference(self, trip_id: UUID, user_id: UUID, pref: MemberPreferenceCreate) -> MemberPreferenceResponse:
        trip = self.trips.get(trip_id)
        if not trip:
            raise NotFoundError(f"Trip with id '{trip_id}' not found")
        if not self.can_view_trip(trip_id, user_id):
            raise ForbiddenError("You do not have access to this trip")

        now = datetime.now(timezone.utc)
        key = f"{trip_id}:{user_id}"
        self.member_preferences[key] = {
            "trip_id": trip_id,
            "user_id": user_id,
            "interests": list(pref.interests),
            "budget_cap": pref.budget_cap,
            "notes": pref.notes,
            "updated_at": now,
        }

        prof = self.profiles.get(user_id)
        return MemberPreferenceResponse(
            trip_id=trip_id,
            user_id=user_id,
            user_email=prof.get("email") if prof else None,
            user_name=prof.get("full_name") if prof else None,
            interests=list(pref.interests),
            budget_cap=pref.budget_cap,
            notes=pref.notes,
            updated_at=now,
        )

    def get_group_preferences(self, trip_id: UUID, user_id: UUID) -> GroupPreferencesSummaryResponse:
        trip = self.trips.get(trip_id)
        if not trip:
            raise NotFoundError(f"Trip with id '{trip_id}' not found")
        if not self.can_view_trip(trip_id, user_id):
            raise ForbiddenError("You do not have access to this trip")

        prefs_list = []
        all_interests = []
        budget_caps = []

        for p in self.member_preferences.values():
            if p["trip_id"] == trip_id:
                prof = self.profiles.get(p["user_id"])
                prefs_list.append(
                    MemberPreferenceResponse(
                        trip_id=trip_id,
                        user_id=p["user_id"],
                        user_email=prof.get("email") if prof else None,
                        user_name=prof.get("full_name") if prof else None,
                        interests=p["interests"],
                        budget_cap=p["budget_cap"],
                        notes=p["notes"],
                        updated_at=p["updated_at"],
                    )
                )
                all_interests.extend(p["interests"])
                if p["budget_cap"] is not None:
                    budget_caps.append(p["budget_cap"])

        # Prioritize shared interests by frequency
        from collections import Counter
        counts = Counter(all_interests)
        # If no member submitted preferences yet, default to trip interests
        merged_interests = [item for item, _ in counts.most_common()] if counts else list(trip.get("interests", []))

        effective_cap = min(budget_caps) if budget_caps else trip.get("budget_total")

        conflicts = []
        if len(budget_caps) > 1 and max(budget_caps) - min(budget_caps) > Decimal("500"):
            conflicts.append(f"Budget disparity: caps range from ${min(budget_caps)} to ${max(budget_caps)} per person.")
        if "nightlife" in counts and "relaxation" in counts:
            conflicts.append("Contrasting styles: Some members prefer nightlife while others prefer relaxation.")
        if "adventure" in counts and "relaxation" in counts:
            conflicts.append("Pacing balance: Members have varying adventure vs leisure preferences.")

        return GroupPreferencesSummaryResponse(
            trip_id=trip_id,
            preferences=prefs_list,
            merged_interests=merged_interests,
            effective_budget_cap=effective_cap,
            conflicts=conflicts,
        )


data_store = InMemoryDataStore()
