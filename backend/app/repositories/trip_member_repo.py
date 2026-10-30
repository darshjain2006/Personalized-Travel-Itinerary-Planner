from typing import List, Optional
from uuid import UUID
from app.schemas.trip_member import (
    TripMemberResponse,
    TripRole,
    InviteMemberRequest,
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


class TripMemberRepository:
    """Repository managing collaborative trip membership and email invitations."""

    def __init__(self, client=supabase_client, store=data_store):
        self.client = client
        self.store = store

    async def list_members(
        self,
        trip_id: UUID,
        user_id: UUID,
        token: Optional[str] = None,
    ) -> List[TripMemberResponse]:
        """List all members joined to a trip."""
        if self.client.is_configured():
            try:
                params = {
                    "trip_id": f"eq.{trip_id}",
                    "select": "*,profiles(*)",
                }
                res = await self.client.get("trip_members", params=params, token=token)
                return [TripMemberResponse(**m) for m in res]
            except (NotFoundError, ForbiddenError):
                raise
            except Exception:
                pass

        return self.store.list_members(trip_id=trip_id, user_id=user_id)

    async def invite_member(
        self,
        trip_id: UUID,
        invite_data: InviteMemberRequest,
        inviter_id: UUID,
        token: Optional[str] = None,
    ) -> TripMemberResponse:
        """Invite a collaborator by email to a trip with an assigned role."""
        if self.client.is_configured():
            try:
                # 1. Lookup user in profiles / auth by email
                params = {"email": f"eq.{invite_data.email.strip().lower()}"}
                profiles = await self.client.get("profiles", params=params, use_service_role=True)
                if not profiles:
                    # If user profile does not exist yet in live Supabase, raise NotFound or create placeholder
                    raise NotFoundError(f"No registered user found with email '{invite_data.email}'")

                invited_user_id = profiles[0]["id"]
                # 2. Add to trip_members
                payload = {
                    "trip_id": str(trip_id),
                    "user_id": str(invited_user_id),
                    "role": invite_data.role.value if hasattr(invite_data.role, "value") else str(invite_data.role),
                }
                res = await self.client.post("trip_members", payload, token=token)
                return TripMemberResponse(**res[0], profile=profiles[0])
            except (NotFoundError, ForbiddenError, ConflictError, ValidationError):
                raise
            except Exception:
                pass

        return self.store.invite_member(
            trip_id=trip_id,
            email=invite_data.email,
            role=invite_data.role,
            inviter_id=inviter_id,
        )

    async def remove_member(
        self,
        trip_id: UUID,
        member_user_id: UUID,
        actor_id: UUID,
        token: Optional[str] = None,
    ) -> bool:
        """Remove a collaborator from a trip or allow a member to leave."""
        if self.client.is_configured():
            try:
                params = {
                    "trip_id": f"eq.{trip_id}",
                    "user_id": f"eq.{member_user_id}",
                }
                await self.client.delete("trip_members", params=params, token=token)
                return True
            except (NotFoundError, ForbiddenError):
                raise
            except Exception:
                pass

        return self.store.remove_member(
            trip_id=trip_id,
            member_user_id=member_user_id,
            actor_id=actor_id,
        )

    async def save_preference(
        self,
        trip_id: UUID,
        user_id: UUID,
        pref_data,
        token: Optional[str] = None,
    ):
        """Save a member's individual preferences and budget cap."""
        if self.client.is_configured():
            try:
                payload = {
                    "trip_id": str(trip_id),
                    "user_id": str(user_id),
                    "interests": list(pref_data.interests),
                    "budget_cap": float(pref_data.budget_cap) if pref_data.budget_cap is not None else None,
                    "notes": pref_data.notes,
                }
                res = await self.client.post("member_preferences", payload, token=token)
                return res[0]
            except (NotFoundError, ForbiddenError):
                raise
            except Exception:
                pass

        return self.store.save_member_preference(
            trip_id=trip_id,
            user_id=user_id,
            pref=pref_data,
        )

    async def get_preferences(
        self,
        trip_id: UUID,
        user_id: UUID,
        token: Optional[str] = None,
    ):
        """Retrieve all member preferences and the merged group consensus."""
        return self.store.get_group_preferences(
            trip_id=trip_id,
            user_id=user_id,
        )


trip_member_repository = TripMemberRepository()
