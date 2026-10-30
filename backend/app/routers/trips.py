from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, status

from app.core.auth import get_current_user, CurrentUser
from app.schemas.trip import TripCreate, TripUpdate, TripResponse
from app.schemas.trip_member import (
    TripMemberResponse,
    InviteMemberRequest,
    MemberPreferenceCreate,
    MemberPreferenceResponse,
    GroupPreferencesSummaryResponse,
)
from app.schemas.itinerary import TripWithDetailsResponse, ItineraryDayWithItemsResponse
from app.schemas.ai import GenerateItineraryRequest, RegenerateDayRequest
from app.schemas.common import MessageResponse
from app.repositories.trip_repo import trip_repository, TripRepository
from app.repositories.trip_member_repo import trip_member_repository, TripMemberRepository
from app.services.ai_planner import ai_planner_service, AIPlannerService
from app.core.rate_limiter import rate_limit_ai_generation

router = APIRouter()


@router.post(
    "",
    response_model=TripResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new trip",
    description="Creates a new travel itinerary trip, adds the creator as owner, and generates initial itinerary days.",
)
async def create_trip(
    trip_data: TripCreate,
    current_user: CurrentUser = Depends(get_current_user),
    repo: TripRepository = Depends(lambda: trip_repository),
) -> TripResponse:
    return await repo.create_trip(
        trip_data=trip_data,
        owner_id=current_user.id,
        user_email=current_user.email,
        token=current_user.raw_token,
    )


@router.get(
    "",
    response_model=List[TripResponse],
    status_code=status.HTTP_200_OK,
    summary="List all trips",
    description="Returns all trips the authenticated user owns or participates in as a member.",
)
async def list_trips(
    current_user: CurrentUser = Depends(get_current_user),
    repo: TripRepository = Depends(lambda: trip_repository),
) -> List[TripResponse]:
    return await repo.list_trips(
        user_id=current_user.id,
        token=current_user.raw_token,
    )


@router.get(
    "/{id}",
    response_model=TripWithDetailsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get trip details",
    description="Retrieves a trip by ID with all its itinerary days, nested itinerary items, and group members.",
)
async def get_trip(
    id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    repo: TripRepository = Depends(lambda: trip_repository),
) -> TripWithDetailsResponse:
    return await repo.get_trip(
        trip_id=id,
        user_id=current_user.id,
        token=current_user.raw_token,
    )


@router.patch(
    "/{id}",
    response_model=TripResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a trip",
    description="Updates trip parameters. Requires owner or editor role.",
)
async def update_trip(
    id: UUID,
    trip_update: TripUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    repo: TripRepository = Depends(lambda: trip_repository),
) -> TripResponse:
    return await repo.update_trip(
        trip_id=id,
        user_id=current_user.id,
        trip_update=trip_update,
        token=current_user.raw_token,
    )


@router.delete(
    "/{id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete a trip",
    description="Permanently deletes a trip along with its days and items. Only the trip owner can perform this.",
)
async def delete_trip(
    id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    repo: TripRepository = Depends(lambda: trip_repository),
) -> MessageResponse:
    await repo.delete_trip(
        trip_id=id,
        user_id=current_user.id,
        token=current_user.raw_token,
    )
    return MessageResponse(success=True, message=f"Trip '{id}' deleted successfully")


# --- Trip Members endpoints ---
@router.post(
    "/{id}/members",
    response_model=TripMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a member to a trip",
    description="Invites a user by email to collaborate on the trip with specified role. Only the trip owner can invite.",
)
async def invite_trip_member(
    id: UUID,
    invite_data: InviteMemberRequest,
    current_user: CurrentUser = Depends(get_current_user),
    member_repo: TripMemberRepository = Depends(lambda: trip_member_repository),
) -> TripMemberResponse:
    return await member_repo.invite_member(
        trip_id=id,
        invite_data=invite_data,
        inviter_id=current_user.id,
        token=current_user.raw_token,
    )


@router.get(
    "/{id}/members",
    response_model=List[TripMemberResponse],
    status_code=status.HTTP_200_OK,
    summary="List trip members",
    description="Returns all collaborators and members associated with the specified trip.",
)
async def list_trip_members(
    id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    member_repo: TripMemberRepository = Depends(lambda: trip_member_repository),
) -> List[TripMemberResponse]:
    return await member_repo.list_members(
        trip_id=id,
        user_id=current_user.id,
        token=current_user.raw_token,
    )


@router.delete(
    "/{id}/members/{user_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove a member from a trip",
    description="Removes a collaborator from the trip. Can be executed by the trip owner, or a member leaving the trip themselves.",
)
async def remove_trip_member(
    id: UUID,
    user_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    member_repo: TripMemberRepository = Depends(lambda: trip_member_repository),
) -> MessageResponse:
    await member_repo.remove_member(
        trip_id=id,
        member_user_id=user_id,
        actor_id=current_user.id,
        token=current_user.raw_token,
    )
    return MessageResponse(success=True, message="Member removed successfully")


@router.post(
    "/{id}/preferences",
    response_model=MemberPreferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit member preferences",
    description="Submits personal interests and budget cap for a trip member to be factored into group AI generation.",
)
async def submit_member_preferences(
    id: UUID,
    request: MemberPreferenceCreate,
    current_user: CurrentUser = Depends(get_current_user),
    member_repo: TripMemberRepository = Depends(lambda: trip_member_repository),
) -> MemberPreferenceResponse:
    return await member_repo.save_preference(
        trip_id=id,
        user_id=current_user.id,
        pref_data=request,
        token=current_user.raw_token,
    )


@router.get(
    "/{id}/preferences",
    response_model=GroupPreferencesSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get group preferences summary",
    description="Retrieves all submitted member preferences, ranked shared interests, effective budget cap, and conflict flags.",
)
async def get_group_preferences(
    id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    member_repo: TripMemberRepository = Depends(lambda: trip_member_repository),
) -> GroupPreferencesSummaryResponse:
    return await member_repo.get_preferences(
        trip_id=id,
        user_id=current_user.id,
        token=current_user.raw_token,
    )


# --- AI Generation & Regeneration Endpoints ---
@router.post(
    "/{id}/generate",
    response_model=TripWithDetailsResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate full AI itinerary",
    description="Invokes Gemini AI with prompt engineering to synthesize a cohesive multi-day schedule, saves all items, and enforces the budget ceiling.",
)
async def generate_itinerary(
    id: UUID,
    request: Optional[GenerateItineraryRequest] = None,
    current_user: CurrentUser = Depends(get_current_user),
    service: AIPlannerService = Depends(lambda: ai_planner_service),
    _rate_limit: str = Depends(rate_limit_ai_generation),
) -> TripWithDetailsResponse:
    return await service.generate_trip_itinerary(
        trip_id=id,
        user_id=current_user.id,
        request=request,
        token=current_user.raw_token,
    )


@router.post(
    "/{id}/days/{day_number}/regenerate",
    response_model=ItineraryDayWithItemsResponse,
    status_code=status.HTTP_200_OK,
    summary="Regenerate a specific day",
    description="Regenerates an individual day schedule with optional instructions while preserving locked items.",
)
async def regenerate_trip_day(
    id: UUID,
    day_number: int,
    request: Optional[RegenerateDayRequest] = None,
    current_user: CurrentUser = Depends(get_current_user),
    service: AIPlannerService = Depends(lambda: ai_planner_service),
    _rate_limit: str = Depends(rate_limit_ai_generation),
) -> ItineraryDayWithItemsResponse:
    return await service.regenerate_day(
        trip_id=id,
        day_number=day_number,
        user_id=current_user.id,
        request=request,
        token=current_user.raw_token,
    )

