from uuid import UUID
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import get_current_user, CurrentUser
from app.repositories.data_store import data_store

TEST_USER_ID = UUID("11111111-1111-1111-1111-111111111111")
OTHER_USER_ID = UUID("22222222-2222-2222-2222-222222222222")


@pytest.fixture(autouse=True)
def clean_store():
    """Reset the in-memory data store before each test run."""
    data_store.reset()
    yield
    data_store.reset()


@pytest.fixture
def mock_current_user():
    return CurrentUser(
        id=TEST_USER_ID,
        email="testuser@example.com",
        role="authenticated",
        full_name="Test User",
    )


@pytest.fixture
def mock_other_user():
    return CurrentUser(
        id=OTHER_USER_ID,
        email="otheruser@example.com",
        role="authenticated",
        full_name="Other User",
    )


@pytest.fixture
def client(mock_current_user):
    """Test client authenticated as mock_current_user."""
    app.dependency_overrides[get_current_user] = lambda: mock_current_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def unauth_client():
    """Test client without any auth dependency overrides."""
    app.dependency_overrides.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
