import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import get_current_user, CurrentUser
from app.repositories.data_store import data_store

client = TestClient(app)

OWNER_ID = uuid4()
EDITOR_ID = uuid4()
VIEWER_ID = uuid4()
STRANGER_ID = uuid4()


@pytest.fixture(autouse=True)
def clean_data_store():
    data_store.reset()
    yield
    data_store.reset()


def make_user(uid: uuid4, email: str = "user@example.com") -> CurrentUser:
    return CurrentUser(
        id=uid,
        email=email,
        raw_token="mock_token",
        role="authenticated",
        user_metadata={"full_name": email.split("@")[0].title()},
    )


def test_viewer_role_cannot_edit_items():
    """Verify that viewers have read-only access and cannot mutate itinerary items."""
    # 1. Owner creates trip
    app.dependency_overrides[get_current_user] = lambda: make_user(OWNER_ID, "owner@example.com")
    trip_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Group Trip",
            "destination": "Barcelona, Spain",
            "start_date": "2026-06-01",
            "end_date": "2026-06-03",
            "num_travelers": 3,
            "traveler_type": "group",
            "budget_total": 3000,
            "budget_level": "mid",
            "pace": "balanced",
            "interests": ["culture", "food"],
        },
    )
    assert trip_res.status_code == 201
    trip_id = trip_res.json()["id"]

    # 2. Owner invites a viewer and an editor
    client.post(
        f"/api/v1/trips/{trip_id}/members",
        json={"email": "viewer@example.com", "role": "viewer"},
    )
    client.post(
        f"/api/v1/trips/{trip_id}/members",
        json={"email": "editor@example.com", "role": "editor"},
    )

    # Find the day id
    details = client.get(f"/api/v1/trips/{trip_id}").json()
    day_id = details["days"][0]["id"]

    # 3. Viewer attempts to add an item -> Expect 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: make_user(VIEWER_ID, "viewer@example.com")
    # Link VIEWER_ID to the invited viewer profile in data_store
    viewer_prof = data_store.find_profile_by_email("viewer@example.com")
    assert viewer_prof is not None
    app.dependency_overrides[get_current_user] = lambda: make_user(viewer_prof["id"], "viewer@example.com")

    add_res = client.post(
        f"/api/v1/days/{day_id}/items",
        json={
            "type": "activity",
            "title": "Park Guell Tour",
            "estimated_cost": 25,
        },
    )
    assert add_res.status_code == 403
    assert "permission" in add_res.json()["detail"].lower()

    # 4. Editor attempts to add an item -> Expect 201 Created
    editor_prof = data_store.find_profile_by_email("editor@example.com")
    assert editor_prof is not None
    app.dependency_overrides[get_current_user] = lambda: make_user(editor_prof["id"], "editor@example.com")

    editor_add_res = client.post(
        f"/api/v1/days/{day_id}/items",
        json={
            "type": "activity",
            "title": "Sagrada Familia Visit",
            "estimated_cost": 35,
        },
    )
    assert editor_add_res.status_code == 201


def test_member_removal_and_leave_workflow():
    """Verify owner can remove members, members can leave, and owner cannot be removed."""
    app.dependency_overrides[get_current_user] = lambda: make_user(OWNER_ID, "owner@example.com")
    trip_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Alps Hike",
            "destination": "Interlaken, Switzerland",
            "start_date": "2026-07-01",
            "end_date": "2026-07-04",
            "num_travelers": 2,
            "traveler_type": "group",
        },
    )
    trip_id = trip_res.json()["id"]

    # Invite member
    client.post(
        f"/api/v1/trips/{trip_id}/members",
        json={"email": "friend@example.com", "role": "editor"},
    )
    friend_prof = data_store.find_profile_by_email("friend@example.com")
    friend_id = friend_prof["id"]

    # Stranger cannot remove friend
    app.dependency_overrides[get_current_user] = lambda: make_user(STRANGER_ID, "stranger@example.com")
    stranger_del = client.delete(f"/api/v1/trips/{trip_id}/members/{friend_id}")
    assert stranger_del.status_code == 403

    # Owner removes friend
    app.dependency_overrides[get_current_user] = lambda: make_user(OWNER_ID, "owner@example.com")
    owner_del = client.delete(f"/api/v1/trips/{trip_id}/members/{friend_id}")
    assert owner_del.status_code == 200

    # Verify friend is gone
    members = client.get(f"/api/v1/trips/{trip_id}/members").json()
    assert len(members) == 1
    assert members[0]["user_id"] == str(OWNER_ID)

    # Owner cannot remove themselves
    owner_self_del = client.delete(f"/api/v1/trips/{trip_id}/members/{OWNER_ID}")
    assert owner_self_del.status_code == 403


def test_item_voting_workflow():
    """Verify group voting with thumbs up, thumbs down, and clearing vote."""
    app.dependency_overrides[get_current_user] = lambda: make_user(OWNER_ID, "owner@example.com")
    trip_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Rome Explorer",
            "destination": "Rome, Italy",
            "start_date": "2026-08-10",
            "end_date": "2026-08-13",
            "num_travelers": 2,
            "traveler_type": "couple",
        },
    )
    trip_id = trip_res.json()["id"]

    details = client.get(f"/api/v1/trips/{trip_id}").json()
    day_id = details["days"][0]["id"]

    # Add activity
    item_res = client.post(
        f"/api/v1/days/{day_id}/items",
        json={"type": "attraction", "title": "Colosseum Arena Tour", "estimated_cost": 40},
    )
    item_id = item_res.json()["id"]

    # Owner upvotes (+1)
    vote1 = client.post(f"/api/v1/items/{item_id}/vote", json={"vote": 1})
    assert vote1.status_code == 200
    assert vote1.json()["upvotes"] == 1
    assert vote1.json()["score"] == 1
    assert vote1.json()["user_vote"] == 1

    # Invite friend and friend downvotes (-1)
    client.post(
        f"/api/v1/trips/{trip_id}/members",
        json={"email": "friend@example.com", "role": "viewer"},
    )
    friend_prof = data_store.find_profile_by_email("friend@example.com")
    app.dependency_overrides[get_current_user] = lambda: make_user(friend_prof["id"], "friend@example.com")

    vote2 = client.post(f"/api/v1/items/{item_id}/vote", json={"vote": -1})
    assert vote2.status_code == 200
    assert vote2.json()["upvotes"] == 1
    assert vote2.json()["downvotes"] == 1
    assert vote2.json()["score"] == 0
    assert vote2.json()["user_vote"] == -1

    # Friend clears vote (0)
    vote3 = client.post(f"/api/v1/items/{item_id}/vote", json={"vote": 0})
    assert vote3.status_code == 200
    assert vote3.json()["upvotes"] == 1
    assert vote3.json()["downvotes"] == 0
    assert vote3.json()["score"] == 1
    assert vote3.json()["user_vote"] is None


def test_group_preferences_and_consensus():
    """Verify submitting individual member preferences and computing consensus."""
    app.dependency_overrides[get_current_user] = lambda: make_user(OWNER_ID, "owner@example.com")
    trip_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Tokyo Friends",
            "destination": "Tokyo, Japan",
            "start_date": "2026-09-01",
            "end_date": "2026-09-07",
            "num_travelers": 2,
            "traveler_type": "group",
            "budget_total": 4000,
        },
    )
    trip_id = trip_res.json()["id"]

    # 1. Owner submits preferences (food, culture, budget cap 2000)
    pref1 = client.post(
        f"/api/v1/trips/{trip_id}/preferences",
        json={"interests": ["food", "culture", "sightseeing"], "budget_cap": 1800},
    )
    assert pref1.status_code == 200

    # 2. Invite member and member submits preferences (food, adventure, nightlife, budget cap 1200)
    client.post(
        f"/api/v1/trips/{trip_id}/members",
        json={"email": "mate@example.com", "role": "editor"},
    )
    mate_prof = data_store.find_profile_by_email("mate@example.com")
    app.dependency_overrides[get_current_user] = lambda: make_user(mate_prof["id"], "mate@example.com")

    pref2 = client.post(
        f"/api/v1/trips/{trip_id}/preferences",
        json={"interests": ["food", "adventure", "nightlife"], "budget_cap": 1200},
    )
    assert pref2.status_code == 200

    # 3. Retrieve group summary
    summary_res = client.get(f"/api/v1/trips/{trip_id}/preferences")
    assert summary_res.status_code == 200
    summary = summary_res.json()

    assert len(summary["preferences"]) == 2
    # Shared interest "food" must be prioritized first
    assert summary["merged_interests"][0] == "food"
    # Effective budget cap must respect the lowest cap ($1200)
    assert float(summary["effective_budget_cap"]) == 1200.0
    # Conflict detected due to budget disparity ($1800 vs $1200 > 500)
    assert len(summary["conflicts"]) >= 1
