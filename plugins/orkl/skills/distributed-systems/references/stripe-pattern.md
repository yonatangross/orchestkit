# Stripe-Style Idempotency Pattern

Stripe's idempotency implementation is considered the gold standard. Here's how to replicate it.

## How Stripe Does It

1. Client sends `Idempotency-Key` header with POST request
2. Server checks if key was seen before
3. If yes: return cached response
4. If no: process request, cache response, return

## Implementation

### Request Flow

```
Client Request
     │
     ▼
┌────────────────┐
│ Check cache    │
│ (Redis)        │
└───────┬────────┘
        │
   ┌────┴────┐
   │ Exists? │
   └────┬────┘
        │
    ┌───┴───┐
   YES      NO
    │        │
    ▼        ▼
┌────────┐ ┌────────────┐
│ Return │ │ Lock key   │
│ cached │ │ (Redis)    │
└────────┘ └─────┬──────┘
                 │
                 ▼
           ┌────────────┐
           │ Process    │
           │ request    │
           └─────┬──────┘
                 │
                 ▼
           ┌────────────┐
           │ Cache      │
           │ response   │
           └─────┬──────┘
                 │
                 ▼
           ┌────────────┐
           │ Return     │
           │ response   │
           └────────────┘
```

### FastAPI Implementation

```python
from fastapi import FastAPI, Request, Header, HTTPException
from typing import Optional
import redis.asyncio as redis
import json
import hashlib

app = FastAPI()
redis_client = redis.from_url("redis://localhost")

IDEMPOTENCY_TTL = 86400  # 24 hours

async def get_idempotency_response(
    key: str,
    path: str,
) -> dict | None:
    """Check for existing idempotent response."""
    cache_key = f"idem:{path}:{key}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    return None

async def set_idempotency_response(
    key: str,
    path: str,
    response: dict,
    status_code: int,
) -> None:
    """Cache response for idempotency key."""
    cache_key = f"idem:{path}:{key}"
    await redis_client.setex(
        cache_key,
        IDEMPOTENCY_TTL,
        json.dumps({
            "body": response,
            "status": status_code,
        }),
    )

async def acquire_idempotency_lock(
    key: str,
    path: str,
    timeout: int = 60,
) -> bool:
    """Acquire lock for processing (prevents concurrent duplicates)."""
    lock_key = f"idem_lock:{path}:{key}"
    return await redis_client.set(lock_key, "1", nx=True, ex=timeout)

async def release_idempotency_lock(key: str, path: str) -> None:
    """Release processing lock."""
    lock_key = f"idem_lock:{path}:{key}"
    await redis_client.delete(lock_key)


@app.post("/v1/charges")
async def create_charge(
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    # If no key, process normally (no idempotency)
    if not idempotency_key:
        return await _process_charge(await request.json())

    path = request.url.path

    # Check for cached response
    cached = await get_idempotency_response(idempotency_key, path)
    if cached:
        return JSONResponse(
            content=cached["body"],
            status_code=cached["status"],
            headers={"Idempotent-Replayed": "true"},
        )

    # Try to acquire lock
    if not await acquire_idempotency_lock(idempotency_key, path):
        # Another request is processing with this key
        raise HTTPException(
            status_code=409,
            detail="A request with this idempotency key is already being processed",
        )

    try:
        # Process the request
        body = await request.json()
        result = await _process_charge(body)

        # Cache the response
        await set_idempotency_response(
            idempotency_key,
            path,
            result,
            status_code=200,
        )

        return result

    finally:
        await release_idempotency_lock(idempotency_key, path)
```

## Client Usage

```python
import httpx
import uuid

async def create_charge_safely(amount: int, currency: str):
    """Create charge with idempotency protection."""
    idempotency_key = str(uuid.uuid4())

    for attempt in range(3):
        try:
            response = await client.post(
                "/v1/charges",
                headers={"Idempotency-Key": idempotency_key},
                json={"amount": amount, "currency": currency},
            )
            return response.json()
        except httpx.TransportError:
            # Network error - safe to retry with same key
            continue

    raise Exception("Failed after 3 attempts")
```

## Key Principles

1. **Keys are client-generated**: Server doesn't generate keys
2. **Keys are scoped to endpoint**: Same key on different endpoints = different operations
3. **24-hour window**: Keys expire after 24 hours
4. **Locked during processing**: Prevents concurrent duplicates
5. **Only success cached**: Errors can be retried
6. **Response fully cached**: Body, status, and relevant headers
