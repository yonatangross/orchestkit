# Message Queue Examples

Complete, production-ready code examples for message queue implementations.

## RabbitMQ Producer/Consumer

### Full Producer Implementation

```python
import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any

import aio_pika
from aio_pika import Message, DeliveryMode, ExchangeType


class RabbitMQProducer:
    """Production-ready RabbitMQ producer with connection management."""

    def __init__(self, url: str):
        self.url = url
        self._connection: aio_pika.RobustConnection | None = None
        self._channel: aio_pika.Channel | None = None
        self._exchanges: dict[str, aio_pika.Exchange] = {}

    async def connect(self):
        """Establish robust connection with auto-reconnect."""
        self._connection = await aio_pika.connect_robust(
            self.url,
            reconnect_interval=5,
            fail_fast=False
        )
        self._channel = await self._connection.channel()

        # Enable publisher confirms for reliable delivery
        await self._channel.set_qos(prefetch_count=10)

    async def declare_exchange(
        self,
        name: str,
        exchange_type: ExchangeType = ExchangeType.TOPIC
    ) -> aio_pika.Exchange:
        """Declare and cache exchange."""
        if name not in self._exchanges:
            self._exchanges[name] = await self._channel.declare_exchange(
                name=name,
                type=exchange_type,
                durable=True
            )
        return self._exchanges[name]

    async def publish(
        self,
        exchange: str,
        routing_key: str,
        payload: dict[str, Any],
        correlation_id: str | None = None,
        headers: dict | None = None
    ) -> str:
        """Publish message with full metadata."""
        message_id = str(uuid.uuid4())
        correlation_id = correlation_id or message_id

        message = Message(
            body=json.dumps(payload).encode(),
            delivery_mode=DeliveryMode.PERSISTENT,
            content_type="application/json",
            message_id=message_id,
            correlation_id=correlation_id,
            timestamp=datetime.now(timezone.utc),
            headers=headers or {}
        )

        exchange_obj = await self.declare_exchange(exchange)
        await exchange_obj.publish(message, routing_key=routing_key)

        return message_id

    async def close(self):
        """Clean shutdown."""
        if self._connection:
            await self._connection.close()


# Usage
async def main():
    producer = RabbitMQProducer("amqp://guest:guest@localhost/")
    await producer.connect()

    message_id = await producer.publish(
        exchange="orders",
        routing_key="order.created",
        payload={
            "order_id": "ORD-123",
            "customer_id": "CUST-456",
            "items": [{"sku": "PROD-1", "qty": 2}]
        }
    )
    print(f"Published message: {message_id}")

    await producer.close()
```

### Full Consumer Implementation

```python
import asyncio
import json
import signal
from typing import Callable, Any
from contextlib import asynccontextmanager

import aio_pika
from aio_pika import IncomingMessage


class RabbitMQConsumer:
    """Production-ready consumer with graceful shutdown."""

    def __init__(self, url: str, queue_name: str, prefetch: int = 10):
        self.url = url
        self.queue_name = queue_name
        self.prefetch = prefetch
        self._connection: aio_pika.RobustConnection | None = None
        self._channel: aio_pika.Channel | None = None
        self._should_stop = False

    async def connect(self):
        self._connection = await aio_pika.connect_robust(self.url)
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=self.prefetch)

    async def consume(
        self,
        handler: Callable[[dict], Any],
        max_retries: int = 3
    ):
        """Consume messages with retry logic."""
        queue = await self._channel.get_queue(self.queue_name)

        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                if self._should_stop:
                    break

                await self._process_message(message, handler, max_retries)

    async def _process_message(
        self,
        message: IncomingMessage,
        handler: Callable,
        max_retries: int
    ):
        """Process single message with error handling."""
        async with message.process(requeue=False):
            try:
                body = json.loads(message.body.decode())
                await handler(body)

            except json.JSONDecodeError as e:
                # Permanent failure - send to DLQ
                await self._reject_to_dlq(message, f"Invalid JSON: {e}")

            except Exception as e:
                retry_count = message.headers.get("x-retry-count", 0)

                if retry_count < max_retries:
                    await self._retry_message(message, retry_count + 1)
                else:
                    await self._reject_to_dlq(message, str(e))

    async def _retry_message(self, message: IncomingMessage, retry_count: int):
        """Republish message for retry with backoff."""
        delay = min(1000 * (2 ** retry_count), 30000)  # Exponential, max 30s

        # Publish to delay exchange (requires retry topology setup)
        exchange = await self._channel.get_exchange(f"retry.{delay}ms")
        await exchange.publish(
            aio_pika.Message(
                body=message.body,
                headers={
                    **dict(message.headers),
                    "x-retry-count": retry_count,
                    "x-original-routing-key": message.routing_key
                }
            ),
            routing_key=self.queue_name
        )

    async def _reject_to_dlq(self, message: IncomingMessage, error: str):
        """Send to dead letter queue with error info."""
        # Message will be routed to DLX configured on queue
        await message.reject(requeue=False)

    def stop(self):
        """Signal consumer to stop."""
        self._should_stop = True

    async def close(self):
        if self._connection:
            await self._connection.close()


# Usage with graceful shutdown
async def main():
    consumer = RabbitMQConsumer(
        url="amqp://guest:guest@localhost/",
        queue_name="orders"
    )
    await consumer.connect()

    # Setup signal handlers
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, consumer.stop)

    async def handle_order(order: dict):
        print(f"Processing order: {order['order_id']}")
        # Simulate processing
        await asyncio.sleep(0.1)

    try:
        await consumer.consume(handle_order)
    finally:
        await consumer.close()
```

---

## Redis Streams Consumer Groups

### Full Implementation

```python
import asyncio
import json
import signal
from datetime import datetime, timezone
from typing import Callable, Any

import redis.asyncio as redis


class RedisStreamConsumer:
    """Production-ready Redis Streams consumer with consumer groups."""

    def __init__(
        self,
        url: str,
        stream: str,
        group: str,
        consumer: str,
        batch_size: int = 10,
        block_ms: int = 5000
    ):
        self.url = url
        self.stream = stream
        self.group = group
        self.consumer = consumer
        self.batch_size = batch_size
        self.block_ms = block_ms
        self._redis: redis.Redis | None = None
        self._should_stop = False

    async def connect(self):
        """Connect and setup consumer group."""
        self._redis = redis.from_url(self.url)

        # Create consumer group if not exists
        try:
            await self._redis.xgroup_create(
                self.stream,
                self.group,
                id="0",  # Start from beginning
                mkstream=True
            )
        except redis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise

    async def consume(self, handler: Callable[[str, dict], Any]):
        """Consume messages with acknowledgment."""
        while not self._should_stop:
            try:
                messages = await self._redis.xreadgroup(
                    groupname=self.group,
                    consumername=self.consumer,
                    streams={self.stream: ">"},
                    count=self.batch_size,
                    block=self.block_ms
                )

                if not messages:
                    continue

                for stream_name, stream_messages in messages:
                    for message_id, data in stream_messages:
                        await self._process_message(
                            message_id.decode(),
                            data,
                            handler
                        )

            except redis.ConnectionError:
                await asyncio.sleep(1)
                await self.connect()

    async def _process_message(
        self,
        message_id: str,
        data: dict,
        handler: Callable
    ):
        """Process and acknowledge message."""
        try:
            # Decode bytes to strings
            decoded = {
                k.decode() if isinstance(k, bytes) else k:
                v.decode() if isinstance(v, bytes) else v
                for k, v in data.items()
            }

            await handler(message_id, decoded)

            # Acknowledge successful processing
            await self._redis.xack(self.stream, self.group, message_id)

        except Exception as e:
            # Log error - message will be redelivered on restart
            print(f"Error processing {message_id}: {e}")

    async def claim_pending(self, min_idle_ms: int = 60000):
        """Claim messages stuck with dead consumers."""
        pending = await self._redis.xpending_range(
            self.stream,
            self.group,
            min="-",
            max="+",
            count=100
        )

        for entry in pending:
            message_id = entry["message_id"]
            idle_time = entry["time_since_delivered"]

            if idle_time > min_idle_ms:
                claimed = await self._redis.xclaim(
                    self.stream,
                    self.group,
                    self.consumer,
                    min_idle_time=min_idle_ms,
                    message_ids=[message_id]
                )
                print(f"Claimed {len(claimed)} messages")

    def stop(self):
        self._should_stop = True

    async def close(self):
        if self._redis:
            await self._redis.close()


class RedisStreamProducer:
    """Simple Redis Streams producer."""

    def __init__(self, url: str, stream: str, maxlen: int = 10000):
        self.url = url
        self.stream = stream
        self.maxlen = maxlen
        self._redis: redis.Redis | None = None

    async def connect(self):
        self._redis = redis.from_url(self.url)

    async def publish(self, data: dict[str, Any]) -> str:
        """Add message to stream."""
        message_id = await self._redis.xadd(
            self.stream,
            data,
            maxlen=self.maxlen,
            approximate=True
        )
        return message_id.decode()

    async def close(self):
        if self._redis:
            await self._redis.close()


# Usage
async def main():
    # Producer
    producer = RedisStreamProducer("redis://localhost", "events")
    await producer.connect()

    msg_id = await producer.publish({
        "event_type": "user.created",
        "user_id": "123",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    print(f"Published: {msg_id}")

    # Consumer
    consumer = RedisStreamConsumer(
        url="redis://localhost",
        stream="events",
        group="processors",
        consumer="worker-1"
    )
    await consumer.connect()

    async def handle_event(msg_id: str, data: dict):
        print(f"Processing {msg_id}: {data}")

    # Run consumer (would normally run indefinitely)
    asyncio.create_task(consumer.consume(handle_event))
    await asyncio.sleep(5)
    consumer.stop()
```

---

## Error Handling Patterns

### Transactional Outbox Pattern

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


class OutboxPublisher:
    """Transactional outbox for reliable message publishing."""

    def __init__(self, db: AsyncSession, producer: RabbitMQProducer):
        self.db = db
        self.producer = producer

    async def publish_with_outbox(
        self,
        exchange: str,
        routing_key: str,
        payload: dict,
        business_operation: Callable
    ):
        """Execute business logic and queue message atomically."""
        async with self.db.begin():
            # Execute business operation
            result = await business_operation()

            # Store message in outbox table
            await self.db.execute(
                text("""
                    INSERT INTO outbox (exchange, routing_key, payload, status)
                    VALUES (:exchange, :routing_key, :payload, 'pending')
                """),
                {
                    "exchange": exchange,
                    "routing_key": routing_key,
                    "payload": json.dumps(payload)
                }
            )

            return result

    async def process_outbox(self):
        """Background worker to publish pending messages."""
        while True:
            async with self.db.begin():
                # Get pending messages
                result = await self.db.execute(
                    text("""
                        SELECT id, exchange, routing_key, payload
                        FROM outbox
                        WHERE status = 'pending'
                        ORDER BY created_at
                        LIMIT 100
                        FOR UPDATE SKIP LOCKED
                    """)
                )

                for row in result:
                    try:
                        await self.producer.publish(
                            row.exchange,
                            row.routing_key,
                            json.loads(row.payload)
                        )

                        await self.db.execute(
                            text("UPDATE outbox SET status = 'published' WHERE id = :id"),
                            {"id": row.id}
                        )
                    except Exception as e:
                        await self.db.execute(
                            text("UPDATE outbox SET status = 'failed', error = :error WHERE id = :id"),
                            {"id": row.id, "error": str(e)}
                        )

            await asyncio.sleep(1)
```

---

## Dead Letter Processing

### DLQ Processor with Retry Decision

```python
class DeadLetterProcessor:
    """Process dead letters with automated and manual retry options."""

    def __init__(self, consumer: RabbitMQConsumer, producer: RabbitMQProducer):
        self.consumer = consumer
        self.producer = producer

    async def process_dlq(self):
        """Consume DLQ and decide on retry or archive."""

        async def handle_dead_letter(message: dict):
            death_info = message.get("x-death", [{}])[0]
            reason = death_info.get("reason", "unknown")
            original_queue = death_info.get("queue", "unknown")

            if self._is_retriable(reason, message):
                # Re-publish to original queue
                await self.producer.publish(
                    exchange="main",
                    routing_key=original_queue,
                    payload=message.get("payload", {}),
                    headers={"x-dlq-retry": True}
                )
            else:
                # Archive for manual review
                await self._archive_message(message, reason)

        await self.consumer.consume(handle_dead_letter)

    def _is_retriable(self, reason: str, message: dict) -> bool:
        """Determine if message should be retried."""
        # Don't retry validation errors
        if "validation" in str(message.get("error", "")).lower():
            return False

        # Retry timeouts and transient failures
        retriable_reasons = ["expired", "maxlen"]
        return reason in retriable_reasons

    async def _archive_message(self, message: dict, reason: str):
        """Store in database for manual review."""
        # Implementation: store in dead_letters table
        pass
```
