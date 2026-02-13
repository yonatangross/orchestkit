---
title: "CDC with Debezium & Idempotent Consumers"
impact: HIGH
impactDescription: "CDC enables high-throughput outbox delivery — misconfigured connectors or missing consumer idempotency leads to data loss or duplicate processing"
tags: cdc, debezium, idempotent-consumer, kafka-connect, dapr, deduplication
---

# CDC with Debezium & Idempotent Consumers

## CDC with Debezium (High-Throughput)

```yaml
# docker-compose.yml - Debezium connector
version: '3.8'
services:
  debezium:
    image: debezium/connect:2.5
    environment:
      BOOTSTRAP_SERVERS: kafka:9092
      GROUP_ID: outbox-connector
      CONFIG_STORAGE_TOPIC: connect-configs
      OFFSET_STORAGE_TOPIC: connect-offsets
```

```json
{
  "name": "outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "secret",
    "database.dbname": "app",
    "table.include.list": "public.outbox",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.table.field.event.id": "id",
    "transforms.outbox.table.field.event.key": "aggregate_id",
    "transforms.outbox.table.field.event.payload": "payload",
    "transforms.outbox.route.topic.replacement": "${routedByValue}-events"
  }
}
```

## Idempotent Consumer

```python
class IdempotentConsumer:
    """Consumer with deduplication using idempotency keys."""

    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis

    async def process(self, event: dict, handler) -> bool:
        """Process event idempotently - returns False if duplicate."""
        idempotency_key = event.get("idempotency_key")
        if not idempotency_key:
            await handler(event)
            return True

        # Check Redis cache first (fast path)
        if await self.redis.exists(f"processed:{idempotency_key}"):
            return False  # Already processed

        # Check database (slow path, but durable)
        exists = await self.db.execute(
            select(ProcessedEvent)
            .where(ProcessedEvent.idempotency_key == idempotency_key)
        )
        if exists.scalar_one_or_none():
            await self.redis.setex(f"processed:{idempotency_key}", 86400, "1")
            return False

        # Process and record
        async with self.db.begin():
            await handler(event)
            self.db.add(ProcessedEvent(idempotency_key=idempotency_key))
            await self.db.flush()

        await self.redis.setex(f"processed:{idempotency_key}", 86400, "1")
        return True


class ProcessedEvent(Base):
    """Track processed events for idempotency."""
    __tablename__ = "processed_events"

    idempotency_key = Column(String(255), primary_key=True)
    processed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

## Dapr Outbox Integration

```python
from dapr.clients import DaprClient

async def create_order_with_dapr(order_data: dict):
    """Dapr handles outbox automatically."""
    async with DaprClient() as client:
        await client.save_state(
            store_name="statestore",
            key=f"order-{order_data['id']}",
            value=order_data,
            state_metadata={
                "outbox.publish": "true",
                "outbox.topic": "orders",
            }
        )
```

## Polling vs CDC Comparison

```
POLLING (OutboxPublisher)          CDC (Debezium)
--------------------------         ----------------
+ Simple to implement              + Higher throughput (100K+ msg/s)
+ No extra infrastructure          + Lower latency (sub-second)
+ Easy to debug                    + No polling overhead
- Polling overhead                 - Complex infrastructure
- Higher latency (1-5s)            - Harder to debug
- Limited throughput (~10K/s)      - Requires Kafka Connect

USE WHEN:                          USE WHEN:
- Starting out                     - High throughput required
- Simple architecture              - Sub-second latency needed
- < 10K events/second              - Already using Kafka
```

## Anti-Patterns (FORBIDDEN)

```python
# NEVER delete without publishing — events lost
await session.execute(delete(OutboxMessage).where(...))

# NEVER process without idempotency check on consumer
async def handle(event):
    await process(event)  # Duplicate processing on retry!

# NEVER ignore ordering — use aggregate_id as partition key
await producer.publish(event_a)  # May arrive out of order!
```
