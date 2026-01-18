# Outbox Pattern Examples

Complete code examples for implementing the transactional outbox pattern.

## 1. Atomic Write with Outbox

Write business entity and outbox message in a single transaction.

```python
from datetime import datetime
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession

class OrderService:
    """Service demonstrating atomic write with outbox."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_order(
        self,
        customer_id: str,
        items: list[dict],
        total: float,
    ) -> Order:
        """Create order and publish event atomically."""
        order = Order(
            id=uuid4(),
            customer_id=customer_id,
            items=items,
            total=total,
            status="pending",
            created_at=datetime.utcnow(),
        )

        # Both in same transaction - atomic!
        self.session.add(order)
        self.session.add(OutboxMessage(
            aggregate_type="Order",
            aggregate_id=order.id,
            event_type="OrderCreated",
            payload={
                "order_id": str(order.id),
                "customer_id": customer_id,
                "items": items,
                "total": total,
                "status": "pending",
                "created_at": order.created_at.isoformat(),
            },
        ))

        await self.session.commit()
        return order

    async def cancel_order(self, order_id: str, reason: str) -> Order:
        """Cancel order and publish event atomically."""
        order = await self.session.get(Order, order_id)
        if not order:
            raise OrderNotFoundError(order_id)

        order.status = "cancelled"
        order.cancelled_at = datetime.utcnow()
        order.cancellation_reason = reason

        self.session.add(OutboxMessage(
            aggregate_type="Order",
            aggregate_id=order.id,
            event_type="OrderCancelled",
            payload={
                "order_id": str(order.id),
                "reason": reason,
                "cancelled_at": order.cancelled_at.isoformat(),
            },
        ))

        await self.session.commit()
        return order
```

## 2. Polling Publisher

Background worker that polls and publishes outbox messages.

```python
import asyncio
import logging
from datetime import datetime
from typing import Callable
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

logger = logging.getLogger(__name__)

class OutboxPollingPublisher:
    """Polls outbox table and publishes to message broker."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        publish_fn: Callable,
        poll_interval: float = 1.0,
        batch_size: int = 100,
        max_retries: int = 5,
    ):
        self.session_factory = session_factory
        self.publish_fn = publish_fn
        self.poll_interval = poll_interval
        self.batch_size = batch_size
        self.max_retries = max_retries
        self._running = False

    async def start(self):
        """Start the polling loop."""
        logger.info("Starting outbox publisher")
        self._running = True

        while self._running:
            try:
                published = await self._process_batch()
                if published == 0:
                    # No messages, wait before next poll
                    await asyncio.sleep(self.poll_interval)
            except Exception as e:
                logger.exception(f"Error in polling loop: {e}")
                await asyncio.sleep(self.poll_interval * 2)

    def stop(self):
        """Stop the polling loop gracefully."""
        logger.info("Stopping outbox publisher")
        self._running = False

    async def _process_batch(self) -> int:
        """Process a batch of pending messages."""
        async with self.session_factory() as session:
            # Select unpublished messages with row lock
            stmt = (
                select(OutboxMessage)
                .where(OutboxMessage.published_at.is_(None))
                .where(OutboxMessage.retry_count < self.max_retries)
                .order_by(OutboxMessage.created_at)
                .limit(self.batch_size)
                .with_for_update(skip_locked=True)
            )
            result = await session.execute(stmt)
            messages = result.scalars().all()

            if not messages:
                return 0

            published_count = 0
            for msg in messages:
                try:
                    await self.publish_fn(
                        topic=f"{msg.aggregate_type.lower()}-events",
                        key=str(msg.aggregate_id),
                        value={
                            "id": str(msg.id),
                            "type": msg.event_type,
                            "aggregate_id": str(msg.aggregate_id),
                            "timestamp": msg.created_at.isoformat(),
                            **msg.payload,
                        },
                    )
                    msg.published_at = datetime.utcnow()
                    published_count += 1
                    logger.debug(f"Published message {msg.id}")
                except Exception as e:
                    msg.retry_count += 1
                    msg.last_error = str(e)[:500]
                    logger.warning(
                        f"Failed to publish {msg.id}, retry {msg.retry_count}: {e}"
                    )

            await session.commit()
            logger.info(f"Published {published_count}/{len(messages)} messages")
            return published_count
```

## 3. Debezium Connector Setup

Docker Compose and configuration for CDC-based delivery.

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp
    command:
      - "postgres"
      - "-c"
      - "wal_level=logical"  # Required for Debezium
    ports:
      - "5432:5432"

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    ports:
      - "9092:9092"

  debezium:
    image: debezium/connect:2.4
    depends_on:
      - kafka
      - postgres
    environment:
      BOOTSTRAP_SERVERS: kafka:9092
      GROUP_ID: outbox-connect
      CONFIG_STORAGE_TOPIC: connect-configs
      OFFSET_STORAGE_TOPIC: connect-offsets
      STATUS_STORAGE_TOPIC: connect-status
    ports:
      - "8083:8083"
```

**Register Debezium Connector:**

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "outbox-connector",
    "config": {
      "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
      "database.hostname": "postgres",
      "database.port": "5432",
      "database.user": "app",
      "database.password": "secret",
      "database.dbname": "myapp",
      "topic.prefix": "myapp",
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
  }'
```

## 4. Retry Handling with Exponential Backoff

```python
import asyncio
from datetime import datetime, timedelta

class RetryablePublisher:
    """Publisher with exponential backoff retry."""

    def __init__(
        self,
        session_factory,
        publish_fn,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        max_retries: int = 5,
    ):
        self.session_factory = session_factory
        self.publish_fn = publish_fn
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.max_retries = max_retries

    def _calculate_delay(self, retry_count: int) -> float:
        """Exponential backoff with jitter."""
        import random
        delay = min(self.base_delay * (2 ** retry_count), self.max_delay)
        jitter = random.uniform(0.5, 1.5)
        return delay * jitter

    async def publish_with_retry(self, message: OutboxMessage) -> bool:
        """Attempt to publish with retries."""
        for attempt in range(self.max_retries):
            try:
                await self.publish_fn(
                    topic=f"{message.aggregate_type.lower()}-events",
                    key=str(message.aggregate_id),
                    value=message.to_event_dict(),
                )
                return True
            except Exception as e:
                if attempt < self.max_retries - 1:
                    delay = self._calculate_delay(attempt)
                    logger.warning(
                        f"Publish failed (attempt {attempt + 1}), "
                        f"retrying in {delay:.1f}s: {e}"
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        f"Publish failed after {self.max_retries} attempts: {e}"
                    )
                    return False
        return False

    async def move_to_dead_letter(
        self,
        session: AsyncSession,
        message: OutboxMessage,
    ):
        """Move failed message to dead letter queue."""
        session.add(DeadLetterMessage(
            original_id=message.id,
            aggregate_type=message.aggregate_type,
            aggregate_id=message.aggregate_id,
            event_type=message.event_type,
            payload=message.payload,
            error=message.last_error,
            failed_at=datetime.utcnow(),
        ))
        await session.delete(message)
        await session.commit()
```

## 5. Cleanup Job

```python
from datetime import datetime, timedelta

async def cleanup_published_messages(
    session: AsyncSession,
    retention_days: int = 7,
    batch_size: int = 10000,
) -> int:
    """Delete old published messages in batches."""
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    total_deleted = 0

    while True:
        # Delete in batches to avoid long locks
        stmt = (
            delete(OutboxMessage)
            .where(OutboxMessage.published_at.isnot(None))
            .where(OutboxMessage.published_at < cutoff)
            .limit(batch_size)
        )
        result = await session.execute(stmt)
        await session.commit()

        deleted = result.rowcount
        total_deleted += deleted

        if deleted < batch_size:
            break

        # Small delay between batches
        await asyncio.sleep(0.1)

    logger.info(f"Cleaned up {total_deleted} published messages")
    return total_deleted
```
