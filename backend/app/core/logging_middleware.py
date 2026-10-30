import logging
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("api.access")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [req:%(request_id)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for structured request logging, request IDs, and latency tracking."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
        request.state.request_id = request_id

        start_time = time.perf_counter()
        client_ip = request.client.host if request.client else "unknown"

        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000.0

            extra = {"request_id": request_id}
            logger.info(
                f"{request.method} {request.url.path} -> {response.status_code} in {duration_ms:.2f}ms (client: {client_ip})",
                extra=extra,
            )
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
            return response
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            extra = {"request_id": request_id}
            logger.error(
                f"{request.method} {request.url.path} -> FAILED after {duration_ms:.2f}ms: {exc}",
                exc_info=True,
                extra=extra,
            )
            raise
