from datetime import datetime, timezone
from typing import Dict
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., json_schema_extra={"example": "healthy"})
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: str = Field(default="1.0.0")
    environment: str = Field(default="development")
    services: Dict[str, str] = Field(default_factory=lambda: {"api": "operational"})
