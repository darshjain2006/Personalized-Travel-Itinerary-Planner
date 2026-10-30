from typing import List, Optional
from uuid import UUID
from app.schemas.trip import TripCreate, TripUpdate, TripResponse
from app.schemas.itinerary import TripWithDetailsResponse
from app.repositories.base import (
    NotFoundError,
    ForbiddenError,
    ConflictError,
    ValidationError,
    RepositoryError,
)
from app.repositories.supabase_client import supabase_client
from app.repositories.data_store import data_store


class TripRepository:
    """Repository handling all trip lifecycle, querying, and Supabase / local persistence."""

    def __init__(self, client=supabase_client, store=data_store):
        self.client = client
        self.store = store

    async def create_trip(
        self,
        trip_data: TripCreate,
        owner_id: UUID,
        user_email: Optional[str] = None,
        token: Optional[str] = None,
    ) -> TripResponse:
        """Create a new trip and auto-initialize owner membership and itinerary days."""
        if self.client.is_configured():
            try:
                payload = trip_data.model_dump(mode="json")
                payload["owner_id"] = str(owner_id)
                # Call Supabase
                res = await self.client.post("trips", payload, token=token)
                if not res:
                    raise RepositoryError("Failed to create trip in Supabase")
                return TripResponse(**res[0])
            except (NotFoundError, ForbiddenError, ConflictError, ValidationError):
                raise
            except Exception:
                # Fallback to local store if Supabase call errors
                pass

        return self.store.create_trip(trip_data, owner_id=owner_id, user_email=user_email)

    async def list_trips(
        self,
        user_id: UUID,
        token: Optional[str] = None,
    ) -> List[TripResponse]:
        """List all trips viewable by the user (owned or joined as member)."""
        if self.client.is_configured():
            try:
                # PostgREST query: RLS automatically filters trips user has access to
                res = await self.client.get("trips", token=token)
                return [TripResponse(**t) for t in res]
            except (NotFoundError, ForbiddenError):
                raise
            except Exception:
                pass

        return self.store.list_trips(user_id=user_id)

    async def get_trip(
        self,
        trip_id: UUID,
        user_id: UUID,
        token: Optional[str] = None,
    ) -> TripWithDetailsResponse:
        """Get a single trip with its days, items, and members nested."""
        if self.client.is_configured():
            try:
                params = {
                    "id": f"eq.{trip_id}",
                    "select": "*,itinerary_days(*,itinerary_items(*)),trip_members(*,profiles(*))",
                }
                res = await self.client.get("trips", params=params, token=token)
                if not res:
                    raise NotFoundError(f"Trip with id '{trip_id}' not found")
                raw = res[0]
                return TripWithDetailsResponse(**raw)
            except (NotFoundError, ForbiddenError):
                raise
            except Exception:
                pass

        return self.store.get_trip(trip_id=trip_id, user_id=user_id)

    async def update_trip(
        self,
        trip_id: UUID,
        user_id: UUID,
        trip_update: TripUpdate,
        token: Optional[str] = None,
    ) -> TripResponse:
        """Update trip attributes if user is owner or editor."""
        if self.client.is_configured():
            try:
                params = {"id": f"eq.{trip_id}"}
                payload = trip_update.model_dump(exclude_unset=True, mode="json")
                res = await self.client.patch("trips", payload, params=params, token=token)
                if not res:
                    raise NotFoundError(f"Trip with id '{trip_id}' not found")
                return TripResponse(**res[0])
            except (NotFoundError, ForbiddenError):
                raise
            except Exception:
                pass

        return self.store.update_trip(trip_id=trip_id, user_id=user_id, trip_update=trip_update)

    async def delete_trip(
        self,
        trip_id: UUID,
        user_id: UUID,
        token: Optional[str] = None,
    ) -> bool:
        """Delete trip if user is the owner."""
        if self.client.is_configured():
            try:
                params = {"id": f"eq.{trip_id}"}
                await self.client.delete("trips", params=params, token=token)
                return True
            except (NotFoundError, ForbiddenError):
                raise
            except Exception:
                pass

        return self.store.delete_trip(trip_id=trip_id, user_id=user_id)


trip_repository = TripRepository()
