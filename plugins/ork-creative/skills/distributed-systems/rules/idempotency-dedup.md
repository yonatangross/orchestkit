---
title: Deduplicate requests using dual-layer Redis and database exactly-once processing
category: idempotency
impact: HIGH
impactDescription: "Ensures events are processed exactly once using dual-layer deduplication with Redis and database"
tags: idempotency, deduplication, redis, events, kafka
---

# Event Consumer Deduplication

Process events exactly once using dual-layer dedup: Redis (fast) + Database (durable).

## Dual-Layer Dedup Pattern

```python
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

class IdempotentConsumer:
    """Process events exactly once using idempotency keys."""

    def __init__(self, db: AsyncSession, redis: redis.Redis):
        self.db = db
        self.redis = redis

    async def process(self, event: dict, handler) -> tuple[Any, bool]:
        """Process event idempotently. Returns (result, was_duplicate)."""
        idempotency_key = event.get("idempotency_key")
        if not idempotency_key:
            return await handler(event), False

        # Fast path: check Redis cache
        cache_key = f"processed:{idempotency_key}"
        if await self.redis.exists(cache_key):
            return None, True

        # Slow path: check database
        existing = await self.db.execute(
            select(ProcessedEvent)
            .where(ProcessedEvent.idempotency_key == idempotency_key)
        )
        if existing.scalar_one_or_none():
            await self.redis.setex(cache_key, 86400, "1")  # Backfill cache
            return None, True

        # Process with database lock to prevent races
        try:
            async with self.db.begin_nested():
                self.db.add(ProcessedEvent(idempotency_key=idempotency_key))
                await self.db.flush()
                result = await handler(event)

            await self.redis.setex(cache_key, 86400, "1")
            return result, False

        except IntegrityError:
            return None, True  # Another process claimed it
```

## Kafka Consumer Integration

```python
async def consume_orders(processor: IdempotentEventProcessor):
    consumer = AIOKafkaConsumer("orders", bootstrap_servers="localhost:9092")
    await consumer.start()

    try:
        async for msg in consumer:
            event = json.loads(msg.value)
            result, was_duplicate = await processor.process_event(
                event_id=event["event_id"],
                event_type="order.created",
                handler=handle_order_created,
                order_data=event["data"],
            )
            if was_duplicate:
                logger.info(f"Skipped duplicate: {event['event_id']}")
    finally:
        await consumer.stop()
```

## Database-Tracked Event Processing

```python
class IdempotentEventProcessor:
    """Track processed events in database for exactly-once semantics."""

    async def process_event(self, event_id: str, event_type: str,
                           handler, *args, **kwargs) -> tuple:
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                try:
                    await conn.execute(
                        "INSERT INTO processed_events (event_id, event_type) VALUES ($1, $2)",
                        event_id, event_type,
                    )
                except UniqueViolationError:
                    existing = await conn.fetchrow(
                        "SELECT result FROM processed_events WHERE event_id = $1",
                        event_id,
                    )
                    return existing["result"], True

                result = await handler(*args, **kwargs)
                await conn.execute(
                    "UPDATE processed_events SET result = $1 WHERE event_id = $2",
                    json.dumps(result) if result else None, event_id,
                )
                return result, False
```

## Key Design Decisions

| Aspect | Recommendation | Rationale |
|--------|----------------|-----------|
| Fast layer | Redis with TTL | Sub-millisecond lookups for hot path |
| Durable layer | Database unique constraint | Survives Redis restart, handles races |
| Lock strategy | INSERT then process | Claim key before processing to prevent races |
| Cache backfill | On DB hit, write to Redis | Speeds up subsequent duplicate checks |
| TTL | 24-72 hours | Balance storage vs replay window |

## Common Mistakes

```python
# NEVER check-then-act without locking
async def bad_process(key):
    if not await exists(key):  # Race condition!
        await process()
        await mark_processed(key)

# CORRECT: Insert first (claims the key atomically)
async def good_process(key):
    try:
        await insert_processed(key)  # Atomic claim
        await process()
    except IntegrityError:
        pass  # Already processed
```

**Incorrect — Redis-only deduplication loses state after restart:**
```python
async def process_event(event_id: str):
    if await redis.exists(f"processed:{event_id}"):
        return  # Already processed
    await handle_event(event_id)
    await redis.set(f"processed:{event_id}", "1", ex=86400)
# Redis restart = all events reprocessed!
```

**Correct — Dual-layer dedup: Redis (fast) + database (durable):**
```python
async def process_event(event_id: str):
    # Fast path: Redis check
    if await redis.exists(f"processed:{event_id}"):
        return
    # Durable check: Database with unique constraint
    try:
        await db.execute("INSERT INTO processed_events (event_id) VALUES ($1)", event_id)
        await handle_event(event_id)
        await redis.set(f"processed:{event_id}", "1", ex=86400)
    except UniqueViolationError:
        pass  # Already processed
```
