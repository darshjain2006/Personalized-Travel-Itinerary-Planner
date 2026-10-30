from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user, CurrentUser
from app.schemas.itinerary import (
    ItineraryItemCreate,
    ItineraryItemUpdate,
    ItineraryItemResponse,
    ReorderItemsRequest,
    ItemVoteRequest,
    ItemVoteSummary,
)
from app.schemas.ai import ReplaceItemRequest
from app.schemas.common import MessageResponse
from app.repositories.itinerary_repo import itinerary_repository, ItineraryRepository
from app.services.ai_planner import ai_planner_service, AIPlannerService
from app.core.rate_limiter import rate_limit_ai_generation

router = APIRouter()


@router.post(
    "/days/{id}/items",
    response_model=ItineraryItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an itinerary item to a day",
    description="Creates a new activity, stay, meal, or transport item for the specified itinerary day.",
)
async def create_item(
    id: UUID,
    item_data: ItineraryItemCreate,
    current_user: CurrentUser = Depends(get_current_user),
    repo: ItineraryRepository = Depends(lambda: itinerary_repository),
) -> ItineraryItemResponse:
    # Ensure item has day_id from path
    if item_data.day_id is None:
        item_data.day_id = id
    return await repo.create_item(
        day_id=id,
        item_data=item_data,
        user_id=current_user.id,
        token=current_user.raw_token,
    )


@router.patch(
    "/items/{id}",
    response_model=ItineraryItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an itinerary item",
    description="Updates details such as title, time, location, cost, or lock status of an itinerary item.",
)
async def update_item(
    id: UUID,
    item_update: ItineraryItemUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    repo: ItineraryRepository = Depends(lambda: itinerary_repository),
) -> ItineraryItemResponse:
    return await repo.update_item(
        item_id=id,
        item_update=item_update,
        user_id=current_user.id,
        token=current_user.raw_token,
    )


@router.delete(
    "/items/{id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete an itinerary item",
    description="Removes an itinerary item and recalculates the day's estimated cost.",
)
async def delete_item(
    id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    repo: ItineraryRepository = Depends(lambda: itinerary_repository),
) -> MessageResponse:
    await repo.delete_item(
        item_id=id,
        user_id=current_user.id,
        token=current_user.raw_token,
    )
    return MessageResponse(success=True, message=f"Itinerary item '{id}' deleted successfully")


@router.post(
    "/days/{id}/items/reorder",
    response_model=List[ItineraryItemResponse],
    status_code=status.HTTP_200_OK,
    summary="Reorder itinerary items in a day",
    description="Updates the order_index sequence of items within the given day.",
)
async def reorder_day_items(
    id: UUID,
    reorder_data: ReorderItemsRequest,
    current_user: CurrentUser = Depends(get_current_user),
    repo: ItineraryRepository = Depends(lambda: itinerary_repository),
) -> List[ItineraryItemResponse]:
    return await repo.reorder_items(
        day_id=id,
        reorder_data=reorder_data,
        user_id=current_user.id,
        token=current_user.raw_token,
    )


@router.post(
    "/items/reorder",
    response_model=List[ItineraryItemResponse],
    status_code=status.HTTP_200_OK,
    summary="Reorder items (global endpoint)",
    description="Reorders items when day_id is provided in the request body.",
)
async def reorder_items_generic(
    reorder_data: ReorderItemsRequest,
    current_user: CurrentUser = Depends(get_current_user),
    repo: ItineraryRepository = Depends(lambda: itinerary_repository),
) -> List[ItineraryItemResponse]:
    if not reorder_data.day_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'day_id' must be specified in the request body for /items/reorder",
        )
    return await repo.reorder_items(
        day_id=reorder_data.day_id,
        reorder_data=reorder_data,
        user_id=current_user.id,
        token=current_user.raw_token,
    )


@router.post(
    "/items/{id}/replace",
    response_model=ItineraryItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Suggest and apply alternative for an activity",
    description="Uses AI to find a nearby alternative activity or dining spot fitting the day's neighborhood and budget constraints, replacing it in the schedule.",
)
async def replace_item_activity(
    id: UUID,
    request: Optional[ReplaceItemRequest] = None,
    current_user: CurrentUser = Depends(get_current_user),
    service: AIPlannerService = Depends(lambda: ai_planner_service),
    _rate_limit: str = Depends(rate_limit_ai_generation),
) -> ItineraryItemResponse:
    return await service.replace_activity(
        item_id=id,
        user_id=current_user.id,
        request=request,
        token=current_user.raw_token,
    )


@router.post(
    "/items/{id}/vote",
    response_model=ItemVoteSummary,
    status_code=status.HTTP_200_OK,
    summary="Vote on an itinerary activity",
    description="Submits a thumbs up (+1), thumbs down (-1), or clear (0) vote on an activity for group consensus.",
)
async def vote_item_activity(
    id: UUID,
    request: ItemVoteRequest,
    current_user: CurrentUser = Depends(get_current_user),
    repo: ItineraryRepository = Depends(lambda: itinerary_repository),
) -> ItemVoteSummary:
    return await repo.vote_item(
        item_id=id,
        user_id=current_user.id,
        vote=request.vote,
        token=current_user.raw_token,
    )

