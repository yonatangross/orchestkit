---
title: "Idempotency: Key Generation"
category: idempotency
impact: HIGH
impactDescription: "Ensures deterministic idempotency key generation using Stripe-style headers for safe API request retries"
tags: idempotency, keys, stripe, headers, deterministic
---

# Idempotency Key Generation & Stripe-Style Header

## Deterministic Key Generation

```python
import hashlib
import json
from typing import Any

def generate_idempotency_key(
    *,
    entity_id: str,
    action: str,
    params: dict[str, Any] | None = None,
) -> str:
    """Generate deterministic idempotency key.

    Same input always produces the same key.
    """
    content = f"{entity_id}:{action}"
    if params:
        content += f":{json.dumps(params, sort_keys=True)}"
    return hashlib.sha256(content.encode()).hexdigest()[:32]

# Examples
key = generate_idempotency_key(
    entity_id="order-123",
    action="create",
    params={"amount": 100, "currency": "USD"},
)
```

## Stripe-Style Idempotency Header

Clients send `Idempotency-Key` header with POST requests. Server caches successful responses and replays them on duplicate requests.

```
Client Request (Idempotency-Key: abc-123)
     |
     v
Check cache (Redis) --> Exists? --> Return cached response
     |                                (Idempotent-Replayed: true)
     NO
     |
     v
Acquire lock --> Process request --> Cache response --> Return
```

## FastAPI Middleware

```python
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis
import json

class IdempotencyMiddleware(BaseHTTPMiddleware):
    """Handle Idempotency-Key header for POST/PUT/PATCH."""

    def __init__(self, app, redis_client: redis.Redis, ttl: int = 86400):
        super().__init__(app)
        self.redis = redis_client
        self.ttl = ttl

    async def dispatch(self, request: Request, call_next):
        if request.method not in ("POST", "PUT", "PATCH"):
            return await call_next(request)

        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return await call_next(request)

        cache_key = f"idem:{request.url.path}:{idempotency_key}"

        # Check for cached response
        cached = await self.redis.get(cache_key)
        if cached:
            data = json.loads(cached)
            return Response(
                content=data["body"],
                status_code=data["status"],
                media_type="application/json",
                headers={"X-Idempotent-Replayed": "true"},
            )

        # Process request
        response = await call_next(request)

        # Cache successful responses only
        if 200 <= response.status_code < 300:
            body = b"".join([chunk async for chunk in response.body_iterator])
            await self.redis.setex(
                cache_key, self.ttl,
                json.dumps({"body": body.decode(), "status": response.status_code}),
            )
            return Response(content=body, status_code=response.status_code,
                          media_type=response.media_type)

        return response
```

## Key Principles

1. **Keys are deterministic** -- same input = same key (never use uuid4)
2. **Keys are scoped to endpoint** -- same key on different endpoints = different operations
3. **24-hour window** -- keys expire after 24 hours
4. **Only cache success** -- errors (4xx/5xx) allow retry
5. **Lock during processing** -- prevents concurrent duplicates

## Common Mistakes

```python
# NEVER use non-deterministic keys
key = str(uuid.uuid4())  # Different every time!

# NEVER include timestamps in keys
key = f"{event.id}:{datetime.now()}"  # Timestamp varies!

# NEVER skip idempotency for financial operations
@router.post("/payments")
async def create_payment(data):
    return await process_payment(data)  # No idempotency!
```

**Incorrect — Random UUID keys make retry detection impossible:**
```python
# Client generates new key on each retry
key = str(uuid.uuid4())  # New key every time!
await post("/api/orders", headers={"Idempotency-Key": key}, data=order)
# Retry creates duplicate order
```

**Correct — Deterministic keys ensure retries are detected and deduplicated:**
```python
# Client generates same key for same operation
key = hashlib.sha256(f"{order_id}:create:{json.dumps(order_data, sort_keys=True)}".encode()).hexdigest()
await post("/api/orders", headers={"Idempotency-Key": key}, data=order)
# Retry returns cached response
```
