# Idempotency Implementation Examples

## FastAPI Idempotency Middleware

```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from typing import Callable
import redis.asyncio as redis
import json
import hashlib

app = FastAPI()
redis_client = redis.from_url("redis://localhost:6379")

IDEMPOTENCY_TTL = 86400  # 24 hours


class IdempotencyMiddleware:
    """Stripe-style idempotency middleware."""

    def __init__(self, app: FastAPI):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)

        # Only apply to mutating methods
        if request.method not in ("POST", "PUT", "PATCH"):
            await self.app(scope, receive, send)
            return

        # Get idempotency key
        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            await self.app(scope, receive, send)
            return

        # Check for cached response
        cache_key = f"idem:{request.url.path}:{idempotency_key}"
        cached = await redis_client.get(cache_key)

        if cached:
            cached_response = json.loads(cached)
            response = JSONResponse(
                content=cached_response["body"],
                status_code=cached_response["status"],
                headers={"Idempotent-Replayed": "true"},
            )
            await response(scope, receive, send)
            return

        # Try to acquire lock
        lock_key = f"idem_lock:{request.url.path}:{idempotency_key}"
        acquired = await redis_client.set(lock_key, "1", nx=True, ex=60)

        if not acquired:
            response = JSONResponse(
                content={"error": "Request with this idempotency key is being processed"},
                status_code=409,
            )
            await response(scope, receive, send)
            return

        try:
            # Process request and capture response
            # (Simplified - real implementation needs response capture)
            await self.app(scope, receive, send)
        finally:
            await redis_client.delete(lock_key)


app.add_middleware(IdempotencyMiddleware)
```

## Database-Backed Idempotency

```python
from sqlalchemy import Column, String, DateTime, Text, Index
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import UTC, datetime, timedelta
import json


class IdempotencyRecord(Base):
    """Track processed idempotency keys."""
    __tablename__ = "idempotency_records"

    idempotency_key = Column(String(64), primary_key=True)
    endpoint = Column(String(256), nullable=False)
    request_hash = Column(String(64), nullable=False)
    response_body = Column(Text, nullable=True)
    response_status = Column(Integer, default=200)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    expires_at = Column(DateTime, nullable=False)

    __table_args__ = (
        Index("ix_idempotency_expires", "expires_at"),
        Index("ix_idempotency_endpoint_key", "endpoint", "idempotency_key"),
    )


async def get_or_create_idempotency(
    db: AsyncSession,
    idempotency_key: str,
    endpoint: str,
    request_body: dict,
    process_func: Callable,
) -> tuple[dict, int, bool]:
    """
    Get cached response or process request idempotently.

    Returns:
        (response_body, status_code, was_replayed)
    """
    # Hash the request to detect mismatched bodies
    request_hash = hashlib.sha256(
        json.dumps(request_body, sort_keys=True).encode()
    ).hexdigest()

    # Check for existing record
    result = await db.execute(
        select(IdempotencyRecord).where(
            IdempotencyRecord.idempotency_key == idempotency_key,
            IdempotencyRecord.endpoint == endpoint,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Verify request body matches
        if existing.request_hash != request_hash:
            raise HTTPException(
                status_code=422,
                detail="Idempotency key reused with different request body",
            )

        # Return cached response
        return (
            json.loads(existing.response_body),
            existing.response_status,
            True,
        )

    # Process the request
    try:
        response_body, status_code = await process_func()

        # Store the result
        record = IdempotencyRecord(
            idempotency_key=idempotency_key,
            endpoint=endpoint,
            request_hash=request_hash,
            response_body=json.dumps(response_body),
            response_status=status_code,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
        db.add(record)
        await db.commit()

        return (response_body, status_code, False)

    except Exception:
        # Don't cache errors - allow retry
        await db.rollback()
        raise


# Usage in endpoint
@app.post("/api/orders")
async def create_order(
    order: OrderCreate,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
):
    async def process():
        # Actual order creation logic
        new_order = Order(**order.model_dump())
        db.add(new_order)
        await db.commit()
        return {"order_id": str(new_order.id)}, 201

    response, status, replayed = await get_or_create_idempotency(
        db=db,
        idempotency_key=idempotency_key,
        endpoint="/api/orders",
        request_body=order.model_dump(),
        process_func=process,
    )

    return JSONResponse(
        content=response,
        status_code=status,
        headers={"Idempotent-Replayed": "true"} if replayed else {},
    )
```

## Event Consumer Idempotency

```python
from dataclasses import dataclass
from datetime import datetime
import asyncpg


@dataclass
class ProcessedEvent:
    event_id: str
    event_type: str
    processed_at: datetime
    result: str | None


class IdempotentEventProcessor:
    """Process events exactly once using database tracking."""

    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool

    async def setup(self):
        """Create tracking table if not exists."""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS processed_events (
                    event_id VARCHAR(64) PRIMARY KEY,
                    event_type VARCHAR(128) NOT NULL,
                    processed_at TIMESTAMPTZ DEFAULT NOW(),
                    result TEXT
                )
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS ix_processed_events_type
                ON processed_events (event_type, processed_at)
            """)

    async def is_processed(self, event_id: str) -> bool:
        """Check if event was already processed."""
        async with self.pool.acquire() as conn:
            result = await conn.fetchval(
                "SELECT 1 FROM processed_events WHERE event_id = $1",
                event_id,
            )
            return result is not None

    async def process_event(
        self,
        event_id: str,
        event_type: str,
        handler: Callable,
        *args,
        **kwargs,
    ) -> tuple[any, bool]:
        """
        Process event idempotently.

        Returns:
            (result, was_duplicate)
        """
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # Try to insert tracking record (fails if exists)
                try:
                    await conn.execute(
                        """
                        INSERT INTO processed_events (event_id, event_type)
                        VALUES ($1, $2)
                        """,
                        event_id,
                        event_type,
                    )
                except asyncpg.UniqueViolationError:
                    # Already processed
                    existing = await conn.fetchrow(
                        "SELECT result FROM processed_events WHERE event_id = $1",
                        event_id,
                    )
                    return existing["result"], True

                # Process the event
                result = await handler(*args, **kwargs)

                # Update with result
                await conn.execute(
                    "UPDATE processed_events SET result = $1 WHERE event_id = $2",
                    json.dumps(result) if result else None,
                    event_id,
                )

                return result, False


# Usage with Kafka consumer
async def consume_orders(processor: IdempotentEventProcessor):
    consumer = AIOKafkaConsumer("orders", bootstrap_servers="localhost:9092")
    await consumer.start()

    try:
        async for msg in consumer:
            event = json.loads(msg.value)
            event_id = event["event_id"]

            result, was_duplicate = await processor.process_event(
                event_id=event_id,
                event_type="order.created",
                handler=handle_order_created,
                order_data=event["data"],
            )

            if was_duplicate:
                logger.info(f"Skipped duplicate event: {event_id}")
            else:
                logger.info(f"Processed event: {event_id}")

    finally:
        await consumer.stop()
```

## Client-Side Retry with Idempotency

```python
import httpx
import uuid
from tenacity import retry, stop_after_attempt, wait_exponential


class IdempotentClient:
    """HTTP client with automatic idempotency key handling."""

    def __init__(self, base_url: str):
        self.client = httpx.AsyncClient(base_url=base_url)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=10),
        reraise=True,
    )
    async def post_idempotent(
        self,
        path: str,
        json: dict,
        idempotency_key: str | None = None,
    ) -> httpx.Response:
        """
        POST with idempotency key.

        Args:
            path: API endpoint path
            json: Request body
            idempotency_key: Optional key (auto-generated if not provided)

        Returns:
            Response from server (may be replayed)
        """
        key = idempotency_key or str(uuid.uuid4())

        response = await self.client.post(
            path,
            json=json,
            headers={"Idempotency-Key": key},
        )

        # Don't retry client errors (4xx)
        if 400 <= response.status_code < 500:
            response.raise_for_status()

        return response

    async def create_payment(self, amount: int, currency: str) -> dict:
        """Create payment with idempotency protection."""
        # Use deterministic key based on content
        key = hashlib.sha256(
            f"payment:{amount}:{currency}:{datetime.now().date()}".encode()
        ).hexdigest()

        response = await self.post_idempotent(
            "/api/payments",
            json={"amount": amount, "currency": currency},
            idempotency_key=key,
        )

        return response.json()


# Usage
async def main():
    client = IdempotentClient("https://api.example.com")

    # Safe to retry - same key prevents duplicate
    payment = await client.create_payment(amount=1000, currency="USD")

    # Check if it was a replay
    if payment.get("_replayed"):
        print("Payment was already processed")
    else:
        print(f"New payment created: {payment['id']}")
```

## Cleanup Job for Expired Records

```python
import asyncio
from datetime import UTC, datetime, timedelta


async def cleanup_expired_idempotency_records(
    db: AsyncSession,
    retention_days: int = 7,
    batch_size: int = 1000,
):
    """
    Delete expired idempotency records in batches.

    Run this as a scheduled job (e.g., daily).
    """
    cutoff = datetime.now(UTC) - timedelta(days=retention_days)
    total_deleted = 0

    while True:
        # Delete in batches to avoid long locks
        result = await db.execute(
            text("""
                DELETE FROM idempotency_records
                WHERE id IN (
                    SELECT id FROM idempotency_records
                    WHERE expires_at < :cutoff
                    LIMIT :batch_size
                )
            """),
            {"cutoff": cutoff, "batch_size": batch_size},
        )
        await db.commit()

        deleted = result.rowcount
        total_deleted += deleted

        if deleted < batch_size:
            break

        # Small delay to reduce database load
        await asyncio.sleep(0.1)

    return total_deleted


# Redis cleanup (handled by TTL, but can force cleanup)
async def cleanup_redis_idempotency_keys(redis_client, pattern: str = "idem:*"):
    """Scan and delete expired keys (if TTL not working)."""
    cursor = 0
    deleted = 0

    while True:
        cursor, keys = await redis_client.scan(cursor, match=pattern, count=100)

        for key in keys:
            ttl = await redis_client.ttl(key)
            if ttl == -1:  # No TTL set
                await redis_client.delete(key)
                deleted += 1

        if cursor == 0:
            break

    return deleted
```

## Testing Idempotency

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_idempotent_request_returns_same_response():
    """Same idempotency key returns cached response."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        idempotency_key = str(uuid.uuid4())

        # First request
        response1 = await client.post(
            "/api/orders",
            json={"product": "widget", "quantity": 1},
            headers={"Idempotency-Key": idempotency_key},
        )
        assert response1.status_code == 201
        order_id = response1.json()["order_id"]

        # Second request with same key
        response2 = await client.post(
            "/api/orders",
            json={"product": "widget", "quantity": 1},
            headers={"Idempotency-Key": idempotency_key},
        )
        assert response2.status_code == 201
        assert response2.json()["order_id"] == order_id
        assert response2.headers.get("Idempotent-Replayed") == "true"


@pytest.mark.asyncio
async def test_different_keys_process_independently():
    """Different idempotency keys process as separate requests."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response1 = await client.post(
            "/api/orders",
            json={"product": "widget", "quantity": 1},
            headers={"Idempotency-Key": str(uuid.uuid4())},
        )
        response2 = await client.post(
            "/api/orders",
            json={"product": "widget", "quantity": 1},
            headers={"Idempotency-Key": str(uuid.uuid4())},
        )

        assert response1.json()["order_id"] != response2.json()["order_id"]


@pytest.mark.asyncio
async def test_mismatched_body_rejected():
    """Reusing key with different body is rejected."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        idempotency_key = str(uuid.uuid4())

        await client.post(
            "/api/orders",
            json={"product": "widget", "quantity": 1},
            headers={"Idempotency-Key": idempotency_key},
        )

        response = await client.post(
            "/api/orders",
            json={"product": "gadget", "quantity": 2},  # Different body!
            headers={"Idempotency-Key": idempotency_key},
        )

        assert response.status_code == 422
        assert "different request body" in response.json()["detail"]
```
