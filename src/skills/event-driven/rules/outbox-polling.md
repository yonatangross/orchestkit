---
title: "Transactional Outbox & Polling Publisher"
impact: HIGH
impactDescription: "The outbox pattern prevents dual-write problems — without atomic outbox writes, events can be lost or published without the corresponding state change"
tags: outbox, transactional-outbox, polling-publisher, skip-locked, idempotency-key
---

# Transactional Outbox & Polling Publisher

## Outbox Table Schema

```sql
CREATE TABLE outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,  -- For consumer deduplication
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    retry_count INT DEFAULT 0,
    last_error TEXT
);

-- Index for polling unpublished messages
CREATE INDEX idx_outbox_unpublished ON outbox(created_at)
    WHERE published_at IS NULL;

-- Index for aggregate ordering
CREATE INDEX idx_outbox_aggregate ON outbox(aggregate_id, created_at);

-- Index for idempotency key lookups
CREATE INDEX idx_outbox_idempotency ON outbox(idempotency_key)
    WHERE idempotency_key IS NOT NULL;
```

## SQLAlchemy Model

```python
from sqlalchemy.dialects.postgresql import UUID, JSONB
import hashlib

class OutboxMessage(Base):
    __tablename__ = "outbox"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aggregate_type = Column(String(100), nullable=False)
    aggregate_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSONB, nullable=False)
    idempotency_key = Column(String(255), unique=True, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    published_at = Column(DateTime, nullable=True)
    retry_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)

    @staticmethod
    def generate_idempotency_key(aggregate_id: str, event_type: str, payload: dict) -> str:
        """Generate deterministic idempotency key for deduplication."""
        content = f"{aggregate_id}:{event_type}:{json.dumps(payload, sort_keys=True)}"
        return hashlib.sha256(content.encode()).hexdigest()[:32]
```

## Write to Outbox in Transaction

```python
from sqlalchemy.ext.asyncio import AsyncSession

class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_order(self, order_data: OrderCreate) -> Order:
        """Create order AND outbox message in single transaction."""
        order = Order(**order_data.model_dump())
        self.db.add(order)

        outbox_msg = OutboxMessage(
            aggregate_type="Order",
            aggregate_id=order.id,
            event_type="OrderCreated",
            payload={
                "order_id": str(order.id),
                "customer_id": str(order.customer_id),
                "total": order.total,
            },
            idempotency_key=OutboxMessage.generate_idempotency_key(
                str(order.id), "OrderCreated", {"total": order.total}
            ),
        )
        self.db.add(outbox_msg)

        await self.db.flush()  # Both written atomically
        return order
```

## Polling Publisher

```python
class OutboxPublisher:
    """Polls outbox and publishes to message broker."""

    def __init__(self, session_factory, producer):
        self.session_factory = session_factory
        self.producer = producer

    async def publish_pending(self, batch_size: int = 100) -> int:
        async with self.session_factory() as session:
            stmt = (
                select(OutboxMessage)
                .where(OutboxMessage.published_at.is_(None))
                .order_by(OutboxMessage.created_at)
                .limit(batch_size)
                .with_for_update(skip_locked=True)  # Prevent duplicate processing
            )
            result = await session.execute(stmt)
            messages = result.scalars().all()

            published = 0
            for msg in messages:
                try:
                    await self.producer.publish(
                        topic=f"{msg.aggregate_type.lower()}-events",
                        key=str(msg.aggregate_id),
                        value={
                            "type": msg.event_type,
                            "idempotency_key": msg.idempotency_key,
                            **msg.payload
                        },
                    )
                    msg.published_at = datetime.now(timezone.utc)
                    published += 1
                except Exception as e:
                    msg.retry_count += 1
                    msg.last_error = str(e)

            await session.commit()
            return published
```

## Key Decisions

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|----------------|
| Delivery | Polling | CDC (Debezium) | Polling for simplicity, CDC for > 10K msg/s |
| Batch size | Small (10-50) | Large (100-500) | Start with 100, tune based on latency |
| Retry | Fixed delay | Exponential backoff | Exponential with max 5 retries |
| Cleanup | Delete published | Archive to cold storage | Archive for audit, delete after 30 days |
| Ordering | Per-aggregate | Global | Per-aggregate via partition key |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER publish before commit — dual-write problem
await producer.publish(event)  # May succeed but commit may fail!
await session.commit()

# NEVER process without locking — causes duplicates
messages = await session.execute(select(OutboxMessage))  # No lock!

# NEVER skip idempotency keys
OutboxMessage(payload=event_data)  # No idempotency_key = duplicate risk

# NEVER store large payloads — use URL references instead
OutboxMessage(payload={"file": large_binary_data})
```
