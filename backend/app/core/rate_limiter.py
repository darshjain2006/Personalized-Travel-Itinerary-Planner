import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import HTTPException, Request, status


class AIRateLimiter:
    """In-memory rate limiter enforcing:
    1. Burst rate limit: max requests per minute.
    2. Daily generation quota: max successful generations per user per calendar day (UTC).
    """

    def __init__(
        self,
        requests_per_minute: int = 6,
        daily_limit: int = 25,
    ):
        self.requests_per_minute = requests_per_minute
        self.daily_limit = daily_limit

        # user_id / client_ip -> list of timestamps in current minute
        self._minute_buckets: Dict[str, List[float]] = defaultdict(list)

        # user_id / client_ip -> { "date": "YYYY-MM-DD", "count": int }
        self._daily_buckets: Dict[str, Dict[str, any]] = defaultdict(dict)

    def _get_today_utc_str(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def check_limit(self, identifier: str) -> None:
        """Verifies both the minute burst limit and the daily quota.
        Raises HTTPException(429) with Retry-After if exceeded.
        """
        now = time.time()
        today = self._get_today_utc_str()

        # 1. Minute window check
        recent_requests = [t for t in self._minute_buckets[identifier] if now - t < 60.0]
        self._minute_buckets[identifier] = recent_requests

        if len(recent_requests) >= self.requests_per_minute:
            oldest = recent_requests[0]
            retry_after = max(1, int(60.0 - (now - oldest)))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: maximum {self.requests_per_minute} AI generations per minute. Please try again in {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )

        # 2. Daily limit check
        daily_record = self._daily_buckets.get(identifier)
        if daily_record and daily_record.get("date") == today:
            current_count = daily_record.get("count", 0)
            if current_count >= self.daily_limit:
                # Calculate seconds until midnight UTC
                now_dt = datetime.now(timezone.utc)
                seconds_until_midnight = ((24 - now_dt.hour - 1) * 3600) + ((60 - now_dt.minute - 1) * 60) + (60 - now_dt.second)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Daily AI generation limit reached ({self.daily_limit}/{self.daily_limit} generations used today). Your quota resets at 00:00 UTC.",
                    headers={"Retry-After": str(seconds_until_midnight)},
                )
        else:
            self._daily_buckets[identifier] = {"date": today, "count": 0}

    def record_usage(self, identifier: str) -> None:
        """Records a successful AI generation consumption."""
        now = time.time()
        today = self._get_today_utc_str()

        self._minute_buckets[identifier].append(now)

        daily_record = self._daily_buckets.get(identifier)
        if daily_record and daily_record.get("date") == today:
            daily_record["count"] = daily_record.get("count", 0) + 1
        else:
            self._daily_buckets[identifier] = {"date": today, "count": 1}

    def get_remaining_daily_quota(self, identifier: str) -> int:
        """Returns the number of generations remaining for this user today."""
        today = self._get_today_utc_str()
        daily_record = self._daily_buckets.get(identifier)
        if daily_record and daily_record.get("date") == today:
            used = daily_record.get("count", 0)
            return max(0, self.daily_limit - used)
        return self.daily_limit

    def reset_for_tests(self) -> None:
        """Resets all buckets for test isolation."""
        self._minute_buckets.clear()
        self._daily_buckets.clear()


ai_rate_limiter = AIRateLimiter()


def rate_limit_ai_generation(request: Request) -> str:
    """FastAPI dependency to enforce AI rate limits and daily quotas."""
    # Authenticated user ID takes precedence, otherwise fallback to client host IP
    user_id = getattr(request.state, "user_id", None)
    identifier = str(user_id) if user_id else (request.client.host if request.client else "unknown_client")
    ai_rate_limiter.check_limit(identifier)
    return identifier
