from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings
from app.repositories.base import (
    NotFoundError,
    ForbiddenError,
    ConflictError,
    ValidationError,
    RepositoryError,
)


class SupabaseClient:
    """Async client for interacting with Supabase PostgREST & Auth REST APIs."""

    def __init__(self):
        self.url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
        self.key = settings.SUPABASE_KEY
        self.service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY

    def is_configured(self) -> bool:
        """Return True if Supabase URL and Key are configured and non-placeholder."""
        return bool(
            self.url
            and self.key
            and "your-project" not in self.url
            and "your-anon-or-service-key" not in self.key
        )

    def _get_headers(self, token: Optional[str] = None, use_service_role: bool = False) -> Dict[str, str]:
        auth_key = self.service_role_key if use_service_role else self.key
        headers = {
            "apikey": auth_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        elif use_service_role:
            headers["Authorization"] = f"Bearer {self.service_role_key}"
        else:
            headers["Authorization"] = f"Bearer {self.key}"
        return headers

    def _handle_response_error(self, response: httpx.Response):
        """Map HTTP error status codes to typed repository exceptions."""
        try:
            data = response.json()
            message = data.get("message") or data.get("error_description") or data.get("hint") or response.text
        except Exception:
            message = response.text or f"HTTP error {response.status_code}"

        if response.status_code == 404:
            raise NotFoundError(message)
        elif response.status_code in (401, 403):
            raise ForbiddenError(message)
        elif response.status_code == 409:
            raise ConflictError(message)
        elif response.status_code == 400:
            raise ValidationError(message)
        else:
            raise RepositoryError(f"Supabase request failed ({response.status_code}): {message}", status_code=response.status_code)

    async def get(
        self,
        table: str,
        params: Optional[Dict[str, Any]] = None,
        token: Optional[str] = None,
        use_service_role: bool = False,
    ) -> List[Dict[str, Any]]:
        """Perform a GET query on a PostgREST table."""
        url = f"{self.url}/rest/v1/{table}"
        headers = self._get_headers(token=token, use_service_role=use_service_role)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            if not resp.is_success:
                self._handle_response_error(resp)
            return resp.json()

    async def post(
        self,
        table: str,
        data: Any,
        token: Optional[str] = None,
        use_service_role: bool = False,
    ) -> List[Dict[str, Any]]:
        """Perform an INSERT query on a PostgREST table."""
        url = f"{self.url}/rest/v1/{table}"
        headers = self._get_headers(token=token, use_service_role=use_service_role)
        headers["Prefer"] = "return=representation"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json=data)
            if not resp.is_success:
                self._handle_response_error(resp)
            return resp.json()

    async def patch(
        self,
        table: str,
        data: Dict[str, Any],
        params: Dict[str, Any],
        token: Optional[str] = None,
        use_service_role: bool = False,
    ) -> List[Dict[str, Any]]:
        """Perform an UPDATE query on a PostgREST table."""
        url = f"{self.url}/rest/v1/{table}"
        headers = self._get_headers(token=token, use_service_role=use_service_role)
        headers["Prefer"] = "return=representation"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.patch(url, headers=headers, params=params, json=data)
            if not resp.is_success:
                self._handle_response_error(resp)
            return resp.json()

    async def delete(
        self,
        table: str,
        params: Dict[str, Any],
        token: Optional[str] = None,
        use_service_role: bool = False,
    ) -> None:
        """Perform a DELETE query on a PostgREST table."""
        url = f"{self.url}/rest/v1/{table}"
        headers = self._get_headers(token=token, use_service_role=use_service_role)
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(url, headers=headers, params=params)
            if not resp.is_success:
                self._handle_response_error(resp)


supabase_client = SupabaseClient()
