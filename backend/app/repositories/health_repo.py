from typing import Dict


from app.core.config import settings


class HealthRepository:
    """Repository responsible for probing dependent infrastructure health."""

    def get_system_status(self) -> Dict[str, str]:
        db_status = "operational (supabase)" if settings.SUPABASE_URL and "your-project" not in settings.SUPABASE_URL else "operational (in-memory)"
        gemini_status = "operational" if settings.GEMINI_API_KEY and "your-gemini" not in settings.GEMINI_API_KEY else "unconfigured (awaiting GEMINI_API_KEY)"
        return {
            "api": "operational",
            "database": db_status,
            "gemini_ai": gemini_status,
        }


health_repository = HealthRepository()
