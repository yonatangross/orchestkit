# Outbox Delivery Patterns

Detailed implementation guide for delivering events from the outbox table to message brokers.

## Delivery Strategies

### 1. Polling-Based Delivery

Simple approach using scheduled jobs to read and publish unpublished messages.

**Pros:**
- Simple to implement and debug
- No additional infrastructure
- Works with any database

**Cons:**
- Latency (polling interval)
- Database load from continuous queries
- Scaling requires coordination

```python
import asyncio
from datetime import datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

class PollingPublisher:
    """Poll outbox table and publish to message broker."""

    def __init__(
        self,
        session_factory,
        producer,
        poll_interval: float = 1.0,
        batch_size: int = 100,
        max_retries: int = 5,
    ):
        self.session_factory = session_factory
        self.producer = producer
        self.poll_interval = poll_interval
        self.batch_size = batch_size
        self.max_retries = max_retries
        self._running = False

    async def start(self):
        """Start the polling loop."""
        self._running = True
        while self._running:
            try:
                published = await self.publish_batch()
                if published == 0:
                    await asyncio.sleep(self.poll_interval)
            except Exception as e:
                logger.error(f"Polling error: {e}")
                await asyncio.sleep(self.poll_interval * 2)

    async def publish_batch(self) -> int:
        """Publish a batch of pending messages."""
        async with self.session_factory() as session:
            # Lock rows to prevent concurrent processing
            stmt = (
                select(OutboxMessage)
                .where(OutboxMessage.published_at.is_(None))
                .where(OutboxMessage.retry_count < self.max_retries)
                .order_by(OutboxMessage.created_at)
                .limit(self.batch_size)
                .with_for_update(skip_locked=True)
            )
            messages = (await session.execute(stmt)).scalars().all()

            published_count = 0
            for msg in messages:
                success = await self._publish_message(msg)
                if success:
                    msg.published_at = datetime.now(datetime.UTC)
                    published_count += 1

            await session.commit()
            return published_count
```

### 2. Change Data Capture (CDC) with Debezium

Stream database changes directly to Kafka using log-based capture.

**Pros:**
- Near real-time delivery (sub-second)
- No polling overhead
- Guaranteed ordering from DB log

**Cons:**
- Additional infrastructure (Debezium, Kafka Connect)
- More complex setup and monitoring
- Database-specific connectors

**Debezium Connector Configuration:**

```json
{
  "name": "outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "debezium",
    "database.password": "${secrets:postgres-password}",
    "database.dbname": "myapp",
    "database.server.name": "myapp",
    "table.include.list": "public.outbox",
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.table.field.event.id": "id",
    "transforms.outbox.table.field.event.key": "aggregate_id",
    "transforms.outbox.table.field.event.type": "event_type",
    "transforms.outbox.table.field.event.payload": "payload",
    "transforms.outbox.route.by.field": "aggregate_type",
    "transforms.outbox.route.topic.replacement": "${routedByValue}-events"
  }
}
```

## Exactly-Once Delivery

### Idempotent Consumers

Consumers must handle duplicate messages gracefully.

```python
class IdempotentConsumer:
    """Process messages exactly once using deduplication."""

    def __init__(self, session_factory, dedup_window: int = 86400):
        self.session_factory = session_factory
        self.dedup_window = dedup_window  # seconds

    async def process(self, message_id: str, handler) -> bool:
        async with self.session_factory() as session:
            # Check if already processed
            existing = await session.execute(
                select(ProcessedMessage).where(
                    ProcessedMessage.message_id == message_id
                )
            )
            if existing.scalar_one_or_none():
                logger.info(f"Skipping duplicate: {message_id}")
                return False

            # Process and record in same transaction
            await handler()
            session.add(ProcessedMessage(
                message_id=message_id,
                processed_at=datetime.now(datetime.UTC),
            ))
            await session.commit()
            return True
```

### Transactional Outbox with Consumer Dedup Table

```sql
-- Consumer-side deduplication table
CREATE TABLE processed_messages (
    message_id UUID PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup old entries
CREATE INDEX idx_processed_messages_time ON processed_messages(processed_at);

-- Cleanup job (run daily)
DELETE FROM processed_messages
WHERE processed_at < NOW() - INTERVAL '7 days';
```

## Ordering Guarantees

### Per-Aggregate Ordering

Use `aggregate_id` as the partition key to ensure events for the same aggregate are processed in order.

```python
async def publish_with_ordering(self, message: OutboxMessage):
    """Publish with partition key for ordering."""
    await self.producer.publish(
        topic=f"{message.aggregate_type.lower()}-events",
        key=str(message.aggregate_id),  # Partition key
        value={
            "id": str(message.id),
            "type": message.event_type,
            "aggregate_id": str(message.aggregate_id),
            "timestamp": message.created_at.isoformat(),
            **message.payload,
        },
        headers={
            "event-type": message.event_type,
            "aggregate-type": message.aggregate_type,
        },
    )
```

### Partition Key Strategies

| Strategy | Use Case | Trade-off |
|----------|----------|-----------|
| `aggregate_id` | Per-entity ordering | Limited parallelism |
| `tenant_id` | Per-tenant ordering | Hotspots for large tenants |
| `event_type` | Type-based routing | No entity ordering |
| `random/round-robin` | Maximum parallelism | No ordering guarantees |

## Delivery Decision Matrix

| Requirement | Polling | CDC (Debezium) |
|-------------|---------|----------------|
| Latency < 100ms | No | Yes |
| Simple infrastructure | Yes | No |
| High throughput (>10k/s) | Limited | Yes |
| Works with any DB | Yes | DB-specific |
| Audit trail built-in | No | Yes (Kafka) |
| Operational complexity | Low | Medium-High |

## Monitoring Metrics

Track these metrics for outbox health:

```python
# Prometheus metrics
outbox_pending_messages = Gauge(
    "outbox_pending_messages",
    "Number of unpublished messages in outbox"
)
outbox_publish_latency = Histogram(
    "outbox_publish_latency_seconds",
    "Time from creation to publish"
)
outbox_publish_errors = Counter(
    "outbox_publish_errors_total",
    "Number of publish failures",
    ["error_type"]
)
outbox_messages_published = Counter(
    "outbox_messages_published_total",
    "Total messages published",
    ["aggregate_type", "event_type"]
)
```

**Alert Thresholds:**
- `outbox_pending_messages > 1000` for 5 minutes - Warning
- `outbox_pending_messages > 10000` for 5 minutes - Critical
- `rate(outbox_publish_errors_total[5m]) > 0.1` - Warning
