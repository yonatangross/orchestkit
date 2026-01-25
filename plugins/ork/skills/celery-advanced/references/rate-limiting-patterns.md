# Rate Limiting Patterns

Per-task and dynamic rate limiting strategies for Celery 5.x.

## Static Rate Limits

```python
# Rate limit syntax: "X/s", "X/m", "X/h"

@celery_app.task(rate_limit="100/m")  # 100 per minute
def call_external_api(endpoint: str) -> dict:
    """Rate limited API calls."""
    return requests.get(endpoint, timeout=30).json()

@celery_app.task(rate_limit="10/s")   # 10 per second
def send_push_notification(user_id: str, message: str):
    """High-frequency but controlled notifications."""
    push_service.send(user_id, message)

@celery_app.task(rate_limit="50/h")   # 50 per hour
def send_marketing_email(batch: list[str]):
    """Low-frequency bulk operations."""
    for email in batch:
        email_service.send(email)
```

## Dynamic Rate Limiting

```python
from celery import current_app

class RateLimitManager:
    """Manage rate limits at runtime."""

    def __init__(self, app):
        self.app = app
        self.defaults = {
            "tasks.call_external_api": "100/m",
            "tasks.send_notification": "10/s",
        }

    def adjust_rate(self, task_name: str, new_rate: str, workers: list = None):
        """Adjust rate limit for running workers."""
        self.app.control.rate_limit(
            task_name,
            new_rate,
            destination=workers,  # None = all workers
        )

    def reduce_for_high_load(self, factor: float = 0.5):
        """Reduce all rates during system stress."""
        for task, rate in self.defaults.items():
            value, unit = int(rate.split("/")[0]), rate.split("/")[1]
            new_rate = f"{int(value * factor)}/{unit}"
            self.adjust_rate(task, new_rate)

    def restore_defaults(self):
        """Restore default rate limits."""
        for task, rate in self.defaults.items():
            self.adjust_rate(task, rate)

# Usage with monitoring
rate_manager = RateLimitManager(celery_app)

def on_api_quota_warning():
    """Called when approaching API quota."""
    rate_manager.adjust_rate("tasks.call_external_api", "20/m")

def on_api_quota_reset():
    """Called when quota resets."""
    rate_manager.restore_defaults()
```

## Token Bucket Rate Limiter

```python
import time
from celery import Task
import redis.asyncio as redis

class TokenBucketTask(Task):
    """Base task with distributed token bucket rate limiting."""

    abstract = True
    rate_limit_key: str = None  # Override in subclass
    tokens_per_second: float = 10.0
    bucket_size: int = 100

    _redis: redis.Redis = None

    @property
    def redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = redis.from_url(REDIS_URL)
        return self._redis

    def acquire_token(self) -> bool:
        """Acquire a token from the bucket."""
        key = f"rate_limit:{self.rate_limit_key}"
        now = time.time()

        # Lua script for atomic token bucket
        script = """
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local rate = tonumber(ARGV[2])
        local capacity = tonumber(ARGV[3])

        local bucket = redis.call('HMGET', key, 'tokens', 'last_update')
        local tokens = tonumber(bucket[1]) or capacity
        local last_update = tonumber(bucket[2]) or now

        -- Add tokens based on time elapsed
        local elapsed = now - last_update
        tokens = math.min(capacity, tokens + elapsed * rate)

        if tokens >= 1 then
            tokens = tokens - 1
            redis.call('HMSET', key, 'tokens', tokens, 'last_update', now)
            redis.call('EXPIRE', key, 3600)
            return 1
        end
        return 0
        """

        return bool(self.redis.eval(
            script, 1, key,
            now, self.tokens_per_second, self.bucket_size
        ))

    def __call__(self, *args, **kwargs):
        if not self.acquire_token():
            # Retry with exponential backoff
            countdown = 2 ** min(self.request.retries, 6)
            raise self.retry(countdown=countdown)
        return super().__call__(*args, **kwargs)

# Usage
@celery_app.task(
    base=TokenBucketTask,
    bind=True,
    rate_limit_key="stripe_api",
    tokens_per_second=25,  # 25 requests/second
    bucket_size=100,       # Burst capacity
)
def charge_customer(self, customer_id: str, amount: int):
    """Rate-limited Stripe API call."""
    return stripe.PaymentIntent.create(
        customer=customer_id,
        amount=amount,
        currency="usd",
    )
```

## Per-User Rate Limiting

```python
from celery import Task
from collections import defaultdict
import threading

class PerUserRateLimitTask(Task):
    """Rate limit per user, not globally."""

    abstract = True
    user_rate_limit: str = "10/m"  # Per user

    _locks = defaultdict(threading.Lock)
    _counters = defaultdict(lambda: {"count": 0, "reset_at": 0})

    def check_user_limit(self, user_id: str) -> bool:
        """Check if user has exceeded their rate limit."""
        rate, period = self._parse_rate(self.user_rate_limit)
        now = time.time()

        with self._locks[user_id]:
            counter = self._counters[user_id]

            # Reset if period elapsed
            if now > counter["reset_at"]:
                counter["count"] = 0
                counter["reset_at"] = now + period

            if counter["count"] >= rate:
                return False

            counter["count"] += 1
            return True

    def _parse_rate(self, rate_str: str) -> tuple[int, int]:
        """Parse '10/m' into (10, 60)."""
        value, unit = rate_str.split("/")
        periods = {"s": 1, "m": 60, "h": 3600}
        return int(value), periods[unit]

@celery_app.task(base=PerUserRateLimitTask, bind=True, user_rate_limit="5/m")
def user_api_request(self, user_id: str, endpoint: str):
    """Rate-limited per user."""
    if not self.check_user_limit(user_id):
        raise self.retry(countdown=60)  # Wait for reset
    return make_api_call(endpoint)
```

## Rate Limit Monitoring

```python
from celery import signals
from prometheus_client import Counter, Gauge

rate_limit_hits = Counter(
    "celery_rate_limit_hits_total",
    "Rate limit hits",
    ["task_name"],
)

rate_limit_retries = Counter(
    "celery_rate_limit_retries_total",
    "Retries due to rate limiting",
    ["task_name"],
)

@signals.task_retry.connect
def on_task_retry(sender, reason, **kwargs):
    """Track rate limit retries."""
    if "rate limit" in str(reason).lower():
        rate_limit_retries.labels(task_name=sender.name).inc()
```

## Rate Limit Patterns Summary

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| Static | Simple API quotas | `@task(rate_limit="100/m")` |
| Dynamic | Adaptive to load | `app.control.rate_limit()` |
| Token bucket | Smooth burst handling | Custom Task base class |
| Per-user | Multi-tenant fairness | User-keyed counters |
