---
title: "Idempotency: Database-Backed"
category: idempotency
impact: HIGH
impactDescription: "Ensures API operations are safely retryable by storing idempotency keys in PostgreSQL with ACID guarantees"
tags: idempotency, database, postgresql, deduplication, api
---

# Database-Backed Idempotency

## Schema

```sql
CREATE TABLE idempotency_records (
    idempotency_key VARCHAR(64) PRIMARY KEY,
    endpoint VARCHAR(256) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_body TEXT,
    response_status INTEGER DEFAULT 200,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ix_idempotency_expires ON idempotency_records (expires_at);
CREATE INDEX ix_idempotency_endpoint_key ON idempotency_records (endpoint, idempotency_key);
```

## Idempotent Execute

```python
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from datetime import UTC, datetime, timedelta
import json

async def idempotent_execute(
    db: AsyncSession,
    idempotency_key: str,
    endpoint: str,
    operation,
    ttl_hours: int = 24,
) -> tuple[Any, int, bool]:
    """Execute operation idempotently. Returns (response, status, was_replayed)."""
    # Check for existing
    existing = await db.get(ProcessedRequest, idempotency_key)
    if existing and existing.expires_at > datetime.now(UTC):
        return json.loads(existing.response_body), existing.status_code, True

    # Execute operation
    result, status_code = await operation()

    # Store result (upsert to handle races)
    stmt = insert(ProcessedRequest).values(
        idempotency_key=idempotency_key,
        endpoint=endpoint,
        status_code=status_code,
        response_body=json.dumps(result),
        expires_at=datetime.now(UTC) + timedelta(hours=ttl_hours),
    ).on_conflict_do_nothing()

    await db.execute(stmt)
    return result, status_code, False
```

## Request Body Validation

Detect misuse: same idempotency key with different request body.

```python
class IdempotencyService:
    def _hash_request(self, body: dict) -> str:
        return hashlib.sha256(
            json.dumps(body, sort_keys=True, default=str).encode()
        ).hexdigest()

    async def check_idempotency(self, key: str, endpoint: str, body: dict):
        row = await self.db.execute(
            text("SELECT request_hash, response_body, response_status "
                 "FROM idempotency_records "
                 "WHERE idempotency_key = :key AND endpoint = :endpoint"),
            {"key": key, "endpoint": endpoint},
        )
        existing = row.fetchone()
        if not existing:
            return None

        if existing.request_hash != self._hash_request(body):
            raise HTTPException(
                status_code=422,
                detail="Idempotency key reused with different request body",
            )
        return {"body": json.loads(existing.response_body),
                "status": existing.response_status, "replayed": True}
```

## TTL Cleanup Job

```python
async def cleanup_expired_records(db: AsyncSession, batch_size: int = 1000) -> int:
    """Delete expired idempotency records. Run daily via scheduler."""
    total_deleted = 0
    while True:
        result = await db.execute(
            text("""
                DELETE FROM idempotency_records
                WHERE idempotency_key IN (
                    SELECT idempotency_key FROM idempotency_records
                    WHERE expires_at < NOW()
                    LIMIT :batch_size
                )
            """),
            {"batch_size": batch_size},
        )
        await db.commit()
        deleted = result.rowcount
        total_deleted += deleted
        if deleted < batch_size:
            break
        await asyncio.sleep(0.1)  # Reduce DB load
    return total_deleted
```

## FastAPI Endpoint Usage

```python
@app.post("/api/orders", status_code=201)
async def create_order(
    order: OrderCreate,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
):
    async def process():
        new_order = Order(**order.model_dump())
        db.add(new_order)
        await db.commit()
        return {"order_id": str(new_order.id)}, 201

    response, status, replayed = await idempotent_execute(
        db=db,
        idempotency_key=idempotency_key,
        endpoint="/api/orders",
        operation=process,
    )
    return JSONResponse(
        content=response, status_code=status,
        headers={"Idempotent-Replayed": "true"} if replayed else {},
    )
```

## Key Decisions

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| Storage | PostgreSQL | ACID guarantees, no extra infra |
| Key format | SHA-256 hash, 32-64 chars | Deterministic, compact |
| TTL | 24-72 hours | Balance storage vs replay window |
| Race handling | ON CONFLICT DO NOTHING | First writer wins |
| Response caching | Status 2xx only | Don't cache errors |
| Cleanup | Batch delete, daily job | Avoid long locks |

**Incorrect — Check-then-act pattern has race condition between check and insert:**
```typescript
const existing = await db.query("SELECT * FROM idempotency_records WHERE key = $1", [key]);
if (!existing) {
  await processPayment(data);  // Race! Two processes both see "not existing"
  await db.query("INSERT INTO idempotency_records (key, result) VALUES ($1, $2)", [key, result]);
}
```

**Correct — Insert-first pattern atomically claims idempotency key:**
```typescript
try {
  await db.query("INSERT INTO idempotency_records (key, status) VALUES ($1, 'processing')", [key]);
  const result = await processPayment(data);
  await db.query("UPDATE idempotency_records SET result = $1 WHERE key = $2", [result, key]);
} catch (UniqueViolationError) {
  return await db.query("SELECT result FROM idempotency_records WHERE key = $1", [key]);
}
```
