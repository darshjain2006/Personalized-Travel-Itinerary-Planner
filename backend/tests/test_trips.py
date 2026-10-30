from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user, create_test_jwt
from tests.conftest import TEST_USER_ID, OTHER_USER_ID


# ==============================================================================
# 1. AUTHENTICATION & DEPENDENCY TESTS
# ==============================================================================

def test_unauthenticated_request_rejected(unauth_client: TestClient):
    """Endpoints protected by get_current_user must reject unauthenticated requests."""
    response = unauth_client.get("/api/v1/trips")
    assert response.status_code == 401
    assert "detail" in response.json()
    assert response.headers.get("WWW-Authenticate") == "Bearer"


def test_invalid_bearer_token_rejected(unauth_client: TestClient):
    """Malformed tokens must return 401 Unauthorized."""
    response = unauth_client.get(
        "/api/v1/trips",
        headers={"Authorization": "Bearer not-a-valid-jwt-token"},
    )
    assert response.status_code == 401


def test_expired_token_rejected(unauth_client: TestClient):
    """Expired tokens must return 401 Unauthorized."""
    expired_token = create_test_jwt(user_id=TEST_USER_ID, expires_in=-10)
    response = unauth_client.get(
        "/api/v1/trips",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_valid_jwt_header_accepted(unauth_client: TestClient):
    """A valid JWT bearer token is accepted by get_current_user."""
    token = create_test_jwt(user_id=TEST_USER_ID, email="traveler@example.com")
    response = unauth_client.get(
        "/api/v1/trips",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# ==============================================================================
# 2. TRIPS ENDPOINTS TESTS (POST, GET, PATCH, DELETE)
# ==============================================================================

def test_create_trip_success(client: TestClient):
    """POST /api/v1/trips creates a trip and returns 201 with owner and days set."""
    trip_payload = {
        "title": "Summer in Kyoto",
        "destination": "Kyoto, Japan",
        "start_date": "2026-08-01",
        "end_date": "2026-08-05",
        "num_travelers": 2,
        "traveler_type": "couple",
        "budget_total": "2500.00",
        "budget_level": "mid",
        "pace": "balanced",
        "interests": ["temples", "culinary", "gardens"],
    }
    response = client.post("/api/v1/trips", json=trip_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Summer in Kyoto"
    assert data["destination"] == "Kyoto, Japan"
    assert data["owner_id"] == str(TEST_USER_ID)
    assert data["status"] == "draft"
    assert "id" in data


def test_create_trip_date_validation_failure(client: TestClient):
    """POST /api/v1/trips with end_date before start_date returns 422."""
    bad_payload = {
        "title": "Invalid Trip",
        "destination": "Kyoto, Japan",
        "start_date": "2026-08-10",
        "end_date": "2026-08-05",
    }
    response = client.post("/api/v1/trips", json=bad_payload)
    assert response.status_code == 422


def test_list_trips(client: TestClient):
    """GET /api/v1/trips lists trips owned or joined by the user."""
    # Create two trips
    client.post(
        "/api/v1/trips",
        json={
            "title": "Trip A",
            "destination": "Paris",
            "start_date": "2026-09-01",
            "end_date": "2026-09-03",
        },
    )
    client.post(
        "/api/v1/trips",
        json={
            "title": "Trip B",
            "destination": "Berlin",
            "start_date": "2026-10-01",
            "end_date": "2026-10-04",
        },
    )

    response = client.get("/api/v1/trips")
    assert response.status_code == 200
    trips = response.json()
    assert len(trips) == 2
    titles = [t["title"] for t in trips]
    assert "Trip A" in titles
    assert "Trip B" in titles


def test_get_trip_nested_details(client: TestClient):
    """GET /api/v1/trips/{id} returns trip with nested days, items, and members."""
    # 1. Create a 3-day trip
    create_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Rome Weekend",
            "destination": "Rome, Italy",
            "start_date": "2026-05-01",
            "end_date": "2026-05-03",
        },
    )
    trip_id = create_res.json()["id"]

    # 2. Retrieve details
    get_res = client.get(f"/api/v1/trips/{trip_id}")
    assert get_res.status_code == 200
    trip_data = get_res.json()
    assert trip_data["id"] == trip_id
    assert len(trip_data["days"]) == 3  # May 1, 2, 3
    assert trip_data["days"][0]["day_number"] == 1
    assert "items" in trip_data["days"][0]
    assert len(trip_data["members"]) >= 1
    assert trip_data["members"][0]["role"] == "owner"


def test_get_trip_not_found(client: TestClient):
    """GET /api/v1/trips/{id} with unknown ID returns 404."""
    unknown_id = uuid4()
    response = client.get(f"/api/v1/trips/{unknown_id}")
    assert response.status_code == 404


def test_trip_access_forbidden_to_strangers(client: TestClient, mock_other_user):
    """A user who is neither owner nor member cannot access another user's trip."""
    # User 1 creates trip
    res = client.post(
        "/api/v1/trips",
        json={
            "title": "Secret Solo Vacation",
            "destination": "Fiji",
            "start_date": "2026-12-01",
            "end_date": "2026-12-07",
        },
    )
    trip_id = res.json()["id"]

    # User 2 tries to access User 1's trip
    app.dependency_overrides[get_current_user] = lambda: mock_other_user
    res_other = client.get(f"/api/v1/trips/{trip_id}")
    assert res_other.status_code == 403


def test_patch_trip(client: TestClient):
    """PATCH /api/v1/trips/{id} updates trip parameters."""
    res = client.post(
        "/api/v1/trips",
        json={
            "title": "Draft Trip",
            "destination": "London",
            "start_date": "2026-06-01",
            "end_date": "2026-06-03",
        },
    )
    trip_id = res.json()["id"]

    patch_res = client.patch(
        f"/api/v1/trips/{trip_id}",
        json={"title": "Updated London Vacation", "budget_total": "1800.00"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["title"] == "Updated London Vacation"
    assert float(patch_res.json()["budget_total"]) == 1800.0


def test_delete_trip(client: TestClient, mock_other_user):
    """DELETE /api/v1/trips/{id} deletes trip if user is owner, rejects strangers."""
    res = client.post(
        "/api/v1/trips",
        json={
            "title": "Trip to Delete",
            "destination": "Dublin",
            "start_date": "2026-07-01",
            "end_date": "2026-07-03",
        },
    )
    trip_id = res.json()["id"]

    # Other user cannot delete
    app.dependency_overrides[get_current_user] = lambda: mock_other_user
    del_forbidden = client.delete(f"/api/v1/trips/{trip_id}")
    assert del_forbidden.status_code == 403

    # Owner can delete
    app.dependency_overrides[get_current_user] = lambda: get_current_user
    from tests.conftest import TEST_USER_ID, CurrentUser
    owner_user = CurrentUser(id=TEST_USER_ID, email="testuser@example.com")
    app.dependency_overrides[get_current_user] = lambda: owner_user

    del_res = client.delete(f"/api/v1/trips/{trip_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Subsequent GET returns 404
    get_res = client.get(f"/api/v1/trips/{trip_id}")
    assert get_res.status_code == 404


# ==============================================================================
# 3. ITINERARY ITEMS ENDPOINTS (POST, PATCH, DELETE, REORDER)
# ==============================================================================

def test_itinerary_items_lifecycle_and_reordering(client: TestClient):
    """Test POST /days/{id}/items, PATCH /items/{id}, reorder items, and DELETE /items/{id}."""
    # 1. Create trip to get day ID
    trip_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Barcelona Art Tour",
            "destination": "Barcelona, Spain",
            "start_date": "2026-09-10",
            "end_date": "2026-09-12",
        },
    )
    trip_id = trip_res.json()["id"]
    details = client.get(f"/api/v1/trips/{trip_id}").json()
    day_id = details["days"][0]["id"]

    # 2. Add Item 1 to day
    item1_res = client.post(
        f"/api/v1/days/{day_id}/items",
        json={
            "type": "attraction",
            "title": "Sagrada Familia",
            "location": "C/ de Mallorca, 401",
            "start_time": "09:30:00",
            "end_time": "11:30:00",
            "estimated_cost": "35.00",
        },
    )
    assert item1_res.status_code == 201
    item1 = item1_res.json()
    assert item1["title"] == "Sagrada Familia"
    item1_id = item1["id"]

    # 3. Add Item 2 to day
    item2_res = client.post(
        f"/api/v1/days/{day_id}/items",
        json={
            "type": "dining",
            "title": "Tapas Lunch at El Xampanyet",
            "estimated_cost": "25.00",
        },
    )
    assert item2_res.status_code == 201
    item2_id = item2_res.json()["id"]

    # 4. Patch Item 1
    patch_res = client.patch(
        f"/api/v1/items/{item1_id}",
        json={"notes": "Book fast-track tower access tickets"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["notes"] == "Book fast-track tower access tickets"

    # 5. Reorder items in day (swap order)
    reorder_res = client.post(
        f"/api/v1/days/{day_id}/items/reorder",
        json={"item_ids": [item2_id, item1_id]},
    )
    assert reorder_res.status_code == 200
    reordered_items = reorder_res.json()
    assert reordered_items[0]["id"] == item2_id
    assert reordered_items[0]["order_index"] == 0
    assert reordered_items[1]["id"] == item1_id
    assert reordered_items[1]["order_index"] == 1

    # 6. Delete Item 2
    del_res = client.delete(f"/api/v1/items/{item2_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 7. Verify Day has only 1 item remaining
    updated_details = client.get(f"/api/v1/trips/{trip_id}").json()
    day_items = updated_details["days"][0]["items"]
    assert len(day_items) == 1
    assert day_items[0]["id"] == item1_id


# ==============================================================================
# 4. TRIP MEMBERS (INVITE BY EMAIL, LIST MEMBERS)
# ==============================================================================

def test_trip_members_workflow(client: TestClient, mock_other_user):
    """Test POST /trips/{id}/members and GET /trips/{id}/members."""
    # Create trip
    trip_res = client.post(
        "/api/v1/trips",
        json={
            "title": "Group Expedition",
            "destination": "Patagonia",
            "start_date": "2026-11-01",
            "end_date": "2026-11-10",
        },
    )
    trip_id = trip_res.json()["id"]

    # Invite a collaborator by email
    invite_res = client.post(
        f"/api/v1/trips/{trip_id}/members",
        json={"email": "colleague@example.com", "role": "editor"},
    )
    assert invite_res.status_code == 201
    member_data = invite_res.json()
    assert member_data["role"] == "editor"
    assert member_data["trip_id"] == trip_id

    # List members
    list_res = client.get(f"/api/v1/trips/{trip_id}/members")
    assert list_res.status_code == 200
    members = list_res.json()
    assert len(members) == 2  # Owner + Invited editor
    roles = [m["role"] for m in members]
    assert "owner" in roles
    assert "editor" in roles

    # Duplicate invitation returns 409 Conflict
    dup_res = client.post(
        f"/api/v1/trips/{trip_id}/members",
        json={"email": "colleague@example.com", "role": "editor"},
    )
    assert dup_res.status_code == 409

    # Non-owner cannot invite
    app.dependency_overrides[get_current_user] = lambda: mock_other_user
    unauth_invite = client.post(
        f"/api/v1/trips/{trip_id}/members",
        json={"email": "hacker@example.com", "role": "viewer"},
    )
    assert unauth_invite.status_code == 403


# ==============================================================================
# 5. OPENAPI DOCUMENTATION ACCURACY
# ==============================================================================

def test_openapi_documentation_accuracy(client: TestClient):
    """Verify that OpenAPI schema at /openapi.json contains accurate routes and tags."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()

    assert "paths" in schema
    paths = schema["paths"]

    # Verify trips endpoints
    assert "/api/v1/trips" in paths
    assert "get" in paths["/api/v1/trips"]
    assert "post" in paths["/api/v1/trips"]

    assert "/api/v1/trips/{id}" in paths
    assert "get" in paths["/api/v1/trips/{id}"]
    assert "patch" in paths["/api/v1/trips/{id}"]
    assert "delete" in paths["/api/v1/trips/{id}"]

    # Verify members endpoints
    assert "/api/v1/trips/{id}/members" in paths
    assert "post" in paths["/api/v1/trips/{id}/members"]
    assert "get" in paths["/api/v1/trips/{id}/members"]

    # Verify items endpoints
    assert "/api/v1/days/{id}/items" in paths
    assert "post" in paths["/api/v1/days/{id}/items"]

    assert "/api/v1/items/{id}" in paths
    assert "patch" in paths["/api/v1/items/{id}"]
    assert "delete" in paths["/api/v1/items/{id}"]

    assert "/api/v1/days/{id}/items/reorder" in paths
    assert "post" in paths["/api/v1/days/{id}/items/reorder"]

    # Verify security schemes
    components = schema.get("components", {})
    security_schemes = components.get("securitySchemes", {})
    assert "HTTPBearer" in security_schemes or any(
        s.get("type") == "http" and s.get("scheme") == "bearer"
        for s in security_schemes.values()
    )
