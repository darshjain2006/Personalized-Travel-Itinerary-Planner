import base64
import hashlib
import hmac
import json
import time
from typing import Optional, Dict, Any, Union
from uuid import UUID
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.core.config import settings

# HTTPBearer security scheme for FastAPI OpenAPI docs
security = HTTPBearer(
    auto_error=False,
    description="Supabase JWT Bearer token format: Bearer <token>",
)


class CurrentUser(BaseModel):
    """Authenticated Supabase user context."""
    id: UUID
    email: Optional[str] = None
    role: str = "authenticated"
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    raw_token: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


def _b64url_decode(s: str) -> bytes:
    """Decode base64url string with appropriate padding."""
    rem = len(s) % 4
    if rem > 0:
        s += "=" * (4 - rem)
    return base64.urlsafe_b64decode(s.encode("utf-8"))


def _b64url_encode(data: bytes) -> str:
    """Encode bytes to base64url string without padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def decode_jwt_payload(token: str) -> Dict[str, Any]:
    """Parse and return the payload dictionary from a JWT token."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT token format: expected 3 dot-separated parts")
    payload_bytes = _b64url_decode(parts[1])
    return json.loads(payload_bytes.decode("utf-8"))


def verify_jwt_signature(token: str, secret: str) -> bool:
    """Verify HMAC-SHA256 signature of a JWT using standard library hmac."""
    parts = token.split(".")
    if len(parts) != 3:
        return False
    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    expected_sig_b64 = _b64url_encode(expected_sig)
    return hmac.compare_digest(sig_b64, expected_sig_b64)


def create_test_jwt(
    user_id: Union[UUID, str],
    email: str = "test@example.com",
    full_name: Optional[str] = None,
    expires_in: int = 3600,
    secret: Optional[str] = None,
) -> str:
    """Create a signed or mock JWT token for testing and local development."""
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "iat": now,
        "exp": now + expires_in,
        "user_metadata": {
            "full_name": full_name or email.split("@")[0],
        },
    }
    header_b64 = _b64url_encode(json.dumps(header).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    sec = secret or settings.SUPABASE_JWT_SECRET or "dev-secret"
    sig = hmac.new(sec.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


async def verify_token_with_supabase(token: str) -> Optional[Dict[str, Any]]:
    """Verify the bearer token directly with Supabase Auth API if configured."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        return None
    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user"
    headers = {
        "apikey": settings.SUPABASE_KEY,
        "Authorization": f"Bearer {token}",
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                return resp.json()
            return None
    except Exception:
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> CurrentUser:
    """FastAPI dependency to extract and validate Supabase JWT bearer token."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme; Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty bearer token provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Decode payload
    try:
        payload = decode_jwt_payload(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed JWT token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check expiration
    exp = payload.get("exp")
    if exp is not None and time.time() > exp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check subject (user id)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(str(user_id_str))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 'sub' claim is not a valid UUID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Signature validation if secret is set
    if settings.SUPABASE_JWT_SECRET:
        if not verify_jwt_signature(token, settings.SUPABASE_JWT_SECRET):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature",
                headers={"WWW-Authenticate": "Bearer"},
            )
    elif settings.SUPABASE_URL and settings.SUPABASE_KEY and "your-project" not in settings.SUPABASE_URL:
        # Live Supabase instance configured: probe auth API
        user_info = await verify_token_with_supabase(token)
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Supabase Auth verification failed",
                headers={"WWW-Authenticate": "Bearer"},
            )

    user_meta = payload.get("user_metadata", {}) or {}
    return CurrentUser(
        id=user_id,
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
        full_name=user_meta.get("full_name") or user_meta.get("name"),
        avatar_url=user_meta.get("avatar_url") or user_meta.get("picture"),
        raw_token=token,
        metadata=user_meta,
    )
