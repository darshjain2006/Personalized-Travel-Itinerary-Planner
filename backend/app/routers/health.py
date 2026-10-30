from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.services.health_service import health_service

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="System Health Check")
def get_health() -> HealthResponse:
    """Returns the operational status of the API and its dependent services."""
    return health_service.check_health()
