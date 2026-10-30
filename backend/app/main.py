from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging_middleware import RequestLoggingMiddleware
from app.repositories.base import RepositoryError
from app.routers import health, trips, items

tags_metadata = [
    {
        "name": "Trips",
        "description": "Endpoints to create, list, retrieve (with nested days and items), update, delete trips, invite collaborators, and generate full AI itineraries or regenerate specific days.",
    },
    {
        "name": "Itinerary Items",
        "description": "Endpoints to add items to days, update item details, delete items, reorder day activities, and suggest AI replacements.",
    },
    {
        "name": "Health",
        "description": "Health checks and subsystem operational status.",
    },
    {
        "name": "Root",
        "description": "API discovery and quick links.",
    },
]

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend REST API core for Personalized Travel Itinerary Planner, supporting Supabase JWT authentication, trips, days, items, and collaborative group membership.",
    openapi_tags=tags_metadata,
)

# Exception handlers for consistent error responses
@app.exception_handler(RepositoryError)
async def repository_error_handler(request: Request, exc: RepositoryError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


# Request Logging Middleware (logs method, path, status, latency)
app.add_middleware(RequestLoggingMiddleware)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health router (root and API v1)
app.include_router(health.router)
app.include_router(health.router, prefix=settings.API_V1_STR)

# Core Business API V1 Routers
app.include_router(trips.router, prefix=f"{settings.API_V1_STR}/trips", tags=["Trips"])
app.include_router(items.router, prefix=settings.API_V1_STR, tags=["Itinerary Items"])


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/health",
        "api_v1": settings.API_V1_STR,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
