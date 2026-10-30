from typing import List, Optional
from uuid import UUID
from app.schemas.itinerary import (
    ItineraryItemCreate,
    ItineraryItemUpdate,
    ItineraryItemResponse,
    ReorderItemsRequest,
)
from app.repositories.base import (
    NotFoundError,
    ForbiddenError,
    ConflictError,
    ValidationError,
    RepositoryError,
)
from app.repositories.supabase_client import supabase_client
from app.repositories.data_store import data_store


class ItineraryRepository:
    """Repository handling itinerary items, creation, mutation, and ordering."""

    def __init__(self, client=supabase_client, store=data_store):
        self.client = client
        self.store = store

    async def create_item(
        self,
        day_id: UUID,
        item_data: ItineraryItemCreate,
        user_id: UUID,
        token: Optional[str] = None,
    ) -> ItineraryItemResponse:
        """Create a new itinerary item in a specified day."""
        if self.client.is_configured():
            try:
                payload = item_data.model_dump(mode="json")
                payload["day_id"] = str(day_id)
                res = await self.client.post("itinerary_items", payload, token=token)
                if not res:
                    raise RepositoryError("Failed to create itinerary item in Supabase")
                return ItineraryItemResponse(**res[0])
            except (NotFoundError, ForbiddenError, ConflictError, ValidationError):
                raise
            except Exception:
                pass

        return self.store.create_item(day_id=day_id, item_data=item_data, user_id=user_id)

    async def update_item(
        self,
        item_id: UUID,
        item_update: ItineraryItemUpdate,
        user_id: UUID,
        token: Optional[str] = None,
    ) -> ItineraryItemResponse:
        """Update fields of an itinerary item."""
        if self.client.is_configured():
            try:
                params = {"id": f"eq.{item_id}"}
                payload = item_update.model_dump(exclude_unset=True, mode="json")
                res = await self.client.patch("itinerary_items", payload, params=params, token=token)
                if not res:
                    raise NotFoundError(f"Itinerary item with id '{item_id}' not found")
                return ItineraryItemResponse(**res[0])
            except (NotFoundError, ForbiddenError):
                raise
            except Exception:
                pass

        return self.store.update_item(item_id=item_id, item_update=item_update, user_id=user_id)

    async def delete_item(
        self,
        item_id: UUID,
        user_id: UUID,
        token: Optional[str] = None,
    ) -> bool:
        """Delete an itinerary item."""
        if self.client.is_configured():
            try:
                params = {"id": f"eq.{item_id}"}
                await self.client.delete("itinerary_items", params=params, token=token)
                return True
            except (NotFoundError, ForbiddenError):
                raise
            except Exception:
                pass

        return self.store.delete_item(item_id=item_id, user_id=user_id)

    async def reorder_items(
        self,
        day_id: UUID,
        reorder_data: ReorderItemsRequest,
        user_id: UUID,
        token: Optional[str] = None,
    ) -> List[ItineraryItemResponse]:
        """Reorder itinerary items inside a day."""
        item_orders = []
        if reorder_data.items:
            for item in reorder_data.items:
                item_orders.append({"id": item.id, "order_index": item.order_index})
        elif reorder_data.item_ids:
            for idx, item_id in enumerate(reorder_data.item_ids):
                item_orders.append({"id": item_id, "order_index": idx})
        else:
            raise ValidationError("Reorder request must contain either 'items' or 'item_ids'")

        if self.client.is_configured():
            try:
                for entry in item_orders:
                    params = {"id": f"eq.{entry['id']}", "day_id": f"eq.{day_id}"}
                    await self.client.patch("itinerary_items", {"order_index": entry["order_index"]}, params=params, token=token)
                # Fetch fresh sorted items
                params = {"day_id": f"eq.{day_id}", "order": "order_index.asc"}
                res = await self.client.get("itinerary_items", params=params, token=token)
                return [ItineraryItemResponse(**i) for i in res]
            except (NotFoundError, ForbiddenError, ValidationError):
                raise
            except Exception:
                pass

        return self.store.reorder_items(day_id=day_id, item_orders=item_orders, user_id=user_id)

    async def vote_item(
        self,
        item_id: UUID,
        user_id: UUID,
        vote: int,
        token: Optional[str] = None,
    ):
        """Cast or clear a thumbs up (+1) / thumbs down (-1) vote on an activity."""
        if self.client.is_configured():
            try:
                if vote == 0:
                    params = {"item_id": f"eq.{item_id}", "user_id": f"eq.{user_id}"}
                    await self.client.delete("item_votes", params=params, token=token)
                else:
                    payload = {
                        "item_id": str(item_id),
                        "user_id": str(user_id),
                        "vote_type": 1 if vote > 0 else -1,
                    }
                    await self.client.post("item_votes", payload, token=token)
            except Exception:
                pass

        return self.store.vote_item(item_id=item_id, user_id=user_id, vote=vote)


itinerary_repository = ItineraryRepository()
