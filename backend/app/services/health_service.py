from datetime import datetime, timezone
from app.core.config import settings
from app.repositories.health_repo import health_repository
from app.schemas.health import HealthResponse


class HealthService:
    """Service layer handling health logic and aggregating subsystem statuses."""

    def __init__(self, repo=health_repository):
        self.repo = repo

    def check_health(self) -> HealthResponse:
        subsystem_status = self.repo.get_system_status()
        return HealthResponse(
            status="healthy",
            timestamp=datetime.now(timezone.utc),
            version=settings.VERSION,
            environment=settings.ENVIRONMENT,
            services=subsystem_status,
        )


health_service = HealthService()
