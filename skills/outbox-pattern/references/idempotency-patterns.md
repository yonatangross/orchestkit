# Idempotency Patterns

## Idempotency Key Generation

```python
import hashlib
import json
from typing import Any

def generate_idempotency_key(
    aggregate_id: str,
    event_type: str,
    payload: dict,
) -> str:
    """Generate deterministic key from event content."""
    # Sort keys for consistent hashing
    content = f"{aggregate_id}:{event_type}:{json.dumps(payload, sort_keys=True)}"
    return hashlib.sha256(content.encode()).hexdigest()[:32]

def generate_request_idempotency_key(
    user_id: str,
    action: str,
    params: dict,
) -> str:
    """Generate key for API request deduplication."""
    content = f"{user_id}:{action}:{json.dumps(params, sort_keys=True)}"
    return hashlib.sha256(content.encode()).hexdigest()[:32]
```

## Database-Backed Deduplication

```python
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import insert

class ProcessedEvent(Base):
    __tablename__ = "processed_events"

    idempotency_key = Column(String(64), primary_key=True)
    processed_at = Column(DateTime, default=lambda: datetime.now(datetime.UTC))
    result = Column(JSONB, nullable=True)  # Cache the result

async def process_idempotently(
    db: AsyncSession,
    idempotency_key: str,
    handler,
) -> tuple[Any, bool]:
    """Returns (result, was_new)."""
    # Check if already processed
    existing = await db.execute(
        select(ProcessedEvent)
        .where(ProcessedEvent.idempotency_key == idempotency_key)
    )
    record = existing.scalar_one_or_none()

    if record:
        return record.result, False  # Return cached result

    # Process and record
    result = await handler()

    # Use upsert to handle race conditions
    stmt = insert(ProcessedEvent).values(
        idempotency_key=idempotency_key,
        result=result,
    ).on_conflict_do_nothing()

    await db.execute(stmt)
    return result, True
```

## Redis-Accelerated Deduplication

```python
import redis.asyncio as redis

class FastIdempotencyChecker:
    """Two-tier deduplication: Redis for speed, DB for durability."""

    def __init__(self, redis_client: redis.Redis, db: AsyncSession):
        self.redis = redis_client
        self.db = db
        self.ttl = 86400 * 7  # 7 days

    async def is_processed(self, key: str) -> bool:
        # Fast path: check Redis
        if await self.redis.exists(f"idem:{key}"):
            return True

        # Slow path: check database
        result = await self.db.execute(
            select(ProcessedEvent)
            .where(ProcessedEvent.idempotency_key == key)
        )
        if result.scalar_one_or_none():
            # Backfill Redis cache
            await self.redis.setex(f"idem:{key}", self.ttl, "1")
            return True

        return False

    async def mark_processed(self, key: str, result: Any = None):
        # Write to both Redis and DB
        await self.redis.setex(f"idem:{key}", self.ttl, "1")
        self.db.add(ProcessedEvent(
            idempotency_key=key,
            result=result,
        ))
```

## API Idempotency Middleware

```python
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

class IdempotencyMiddleware(BaseHTTPMiddleware):
    """Handle Idempotency-Key header for POST/PUT/PATCH."""

    async def dispatch(self, request: Request, call_next):
        if request.method not in ("POST", "PUT", "PATCH"):
            return await call_next(request)

        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return await call_next(request)

        # Check cache
        cached = await redis.get(f"api:idem:{idempotency_key}")
        if cached:
            return Response(
                content=cached,
                media_type="application/json",
                headers={"X-Idempotent-Replay": "true"},
            )

        # Process request
        response = await call_next(request)

        # Cache successful responses
        if 200 <= response.status_code < 300:
            body = b"".join([chunk async for chunk in response.body_iterator])
            await redis.setex(
                f"api:idem:{idempotency_key}",
                86400,  # 24 hours
                body,
            )
            return Response(
                content=body,
                status_code=response.status_code,
                media_type=response.media_type,
            )

        return response
```

## Common Pitfalls

```python
# WRONG: Non-deterministic key generation
def bad_key():
    return str(uuid.uuid4())  # Different every time!

# WRONG: Including timestamps in key
def bad_key(event):
    return f"{event.id}:{datetime.now(datetime.UTC)}"  # Timestamp varies!

# WRONG: Not handling race conditions
async def bad_check(key):
    if not await exists(key):
        await process()
        await mark_processed(key)
    # Race: two processes check simultaneously!

# CORRECT: Use database constraints or atomic operations
async def good_check(key):
    try:
        # Use INSERT ON CONFLICT or Redis SETNX
        await atomic_mark_and_process(key)
    except DuplicateKeyError:
        pass  # Already processed
```
