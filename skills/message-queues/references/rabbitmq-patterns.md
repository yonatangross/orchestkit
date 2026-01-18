# RabbitMQ Patterns Reference

Detailed implementation patterns for RabbitMQ message queuing.

## Exchange Types

### Direct Exchange

Routes messages to queues based on exact routing key match.

```python
# Declare direct exchange
await channel.declare_exchange(
    name="notifications",
    type=aio_pika.ExchangeType.DIRECT,
    durable=True
)

# Bind queue with specific routing key
await queue.bind(exchange="notifications", routing_key="email")
await queue.bind(exchange="notifications", routing_key="sms")

# Publish to specific routing key
await exchange.publish(
    message=Message(body=b"Send email"),
    routing_key="email"  # Only email queue receives this
)
```

**Use cases:**
- Task routing to specific workers
- Service-to-service direct communication
- Notifications by type (email, sms, push)

### Topic Exchange

Routes based on pattern matching with wildcards.

```python
# Declare topic exchange
await channel.declare_exchange(
    name="events",
    type=aio_pika.ExchangeType.TOPIC,
    durable=True
)

# Bind with wildcard patterns
await queue.bind(exchange="events", routing_key="order.created")
await queue.bind(exchange="events", routing_key="order.*")       # order.created, order.updated
await queue.bind(exchange="events", routing_key="*.created")     # order.created, user.created
await queue.bind(exchange="events", routing_key="audit.#")       # audit.*, audit.*.*, etc.

# Publish with specific routing key
await exchange.publish(message, routing_key="order.created.us")
```

**Wildcards:**
- `*` matches exactly one word
- `#` matches zero or more words

**Use cases:**
- Event-driven architectures
- Multi-tenant message routing
- Audit logging (capture all events)

### Fanout Exchange

Broadcasts to all bound queues (ignores routing key).

```python
# Declare fanout exchange
await channel.declare_exchange(
    name="broadcasts",
    type=aio_pika.ExchangeType.FANOUT,
    durable=True
)

# All bound queues receive every message
await queue1.bind(exchange="broadcasts")
await queue2.bind(exchange="broadcasts")

# Routing key is ignored
await exchange.publish(message, routing_key="")  # All queues get this
```

**Use cases:**
- Cache invalidation across services
- Real-time notifications to all subscribers
- System-wide announcements

---

## Queue Configuration

### Durable vs Transient

```python
# Durable queue - survives broker restart
durable_queue = await channel.declare_queue(
    name="orders",
    durable=True,      # Queue definition persisted
    auto_delete=False  # Queue persists when consumers disconnect
)

# Transient queue - for temporary consumers
temp_queue = await channel.declare_queue(
    name="",           # Auto-generated name
    exclusive=True,    # Only this connection can consume
    auto_delete=True   # Deleted when connection closes
)
```

### Queue Arguments

```python
await channel.declare_queue(
    name="tasks",
    durable=True,
    arguments={
        # TTL for messages in queue
        "x-message-ttl": 86400000,  # 24 hours in ms

        # Max queue length
        "x-max-length": 10000,
        "x-overflow": "reject-publish",  # or "drop-head"

        # Dead letter exchange
        "x-dead-letter-exchange": "dlx",
        "x-dead-letter-routing-key": "failed.tasks",

        # Single active consumer
        "x-single-active-consumer": True,

        # Queue expiry (if unused)
        "x-expires": 3600000  # 1 hour
    }
)
```

### Priority Queues

```python
# Declare priority queue
await channel.declare_queue(
    name="priority-tasks",
    durable=True,
    arguments={"x-max-priority": 10}  # Priority levels 0-10
)

# Publish with priority
await exchange.publish(
    Message(
        body=b"Urgent task",
        priority=10  # Highest priority
    ),
    routing_key="tasks"
)
```

---

## Dead Letter Queues

### Setup DLX

```python
# 1. Declare dead letter exchange
dlx = await channel.declare_exchange(
    name="dlx",
    type=aio_pika.ExchangeType.DIRECT,
    durable=True
)

# 2. Declare dead letter queue
dlq = await channel.declare_queue(
    name="failed-messages",
    durable=True
)
await dlq.bind(dlx, routing_key="failed")

# 3. Configure main queue to use DLX
main_queue = await channel.declare_queue(
    name="tasks",
    durable=True,
    arguments={
        "x-dead-letter-exchange": "dlx",
        "x-dead-letter-routing-key": "failed"
    }
)
```

### DLQ Consumer for Analysis

```python
async def process_dead_letters(message: aio_pika.IncomingMessage):
    async with message.process():
        # Extract failure metadata
        headers = message.headers
        death_info = headers.get("x-death", [{}])[0]

        original_queue = death_info.get("queue")
        reason = death_info.get("reason")  # rejected, expired, maxlen
        death_count = death_info.get("count", 1)

        # Log for analysis
        logger.error(
            "Dead letter received",
            original_queue=original_queue,
            reason=reason,
            death_count=death_count,
            body=message.body.decode()
        )

        # Optional: Store in database for dashboard
        await db.execute(
            "INSERT INTO dead_letters (queue, reason, body, created_at) VALUES ($1, $2, $3, NOW())",
            original_queue, reason, message.body.decode()
        )
```

### Retry with DLX

```python
async def setup_retry_topology(channel):
    """Create retry topology with exponential backoff."""

    # Main exchange
    main_exchange = await channel.declare_exchange("main", "direct", durable=True)

    # Retry exchanges with increasing delays
    for delay in [1000, 5000, 30000]:  # 1s, 5s, 30s
        retry_exchange = await channel.declare_exchange(
            f"retry.{delay}ms", "direct", durable=True
        )
        retry_queue = await channel.declare_queue(
            f"retry.{delay}ms.queue",
            durable=True,
            arguments={
                "x-message-ttl": delay,
                "x-dead-letter-exchange": "main"
            }
        )
        await retry_queue.bind(retry_exchange)

    # Final DLX for exhausted retries
    dlx = await channel.declare_exchange("dlx", "direct", durable=True)
    dlq = await channel.declare_queue("dead-letters", durable=True)
    await dlq.bind(dlx)
```

---

## Consumer Acknowledgments

### Manual Acknowledgment

```python
async def consume_with_ack(queue_name: str, handler):
    queue = await channel.get_queue(queue_name)

    async with queue.iterator() as queue_iter:
        async for message in queue_iter:
            # Process without auto-ack
            async with message.process(requeue=False):
                try:
                    body = json.loads(message.body.decode())
                    await handler(body)
                    # Message auto-acked when context exits normally
                except Exception as e:
                    # Explicitly reject and send to DLX
                    await message.reject(requeue=False)
                    logger.error(f"Message rejected: {e}")
```

### Batched Acknowledgment

```python
async def consume_batched(queue_name: str, handler, batch_size: int = 100):
    """Acknowledge in batches for better throughput."""
    queue = await channel.get_queue(queue_name)
    pending_acks = []

    async with queue.iterator() as queue_iter:
        async for message in queue_iter:
            try:
                body = json.loads(message.body.decode())
                await handler(body)
                pending_acks.append(message)

                # Batch ack
                if len(pending_acks) >= batch_size:
                    await channel.basic_ack(
                        delivery_tag=pending_acks[-1].delivery_tag,
                        multiple=True  # Ack all messages up to this tag
                    )
                    pending_acks.clear()

            except Exception as e:
                await message.reject(requeue=False)
```

### Prefetch (QoS)

```python
# Set prefetch count to limit unacked messages
await channel.set_qos(prefetch_count=10)

# Higher prefetch = better throughput, but risk of message loss on crash
# Lower prefetch = safer, but slower
# Recommendation: Start with 10, tune based on monitoring
```

---

## Best Practices

### Message Design

```python
# Good: Small, self-contained messages
message = {
    "event_id": str(uuid.uuid4()),
    "event_type": "order.created",
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "data": {
        "order_id": "123",
        "customer_id": "456"
    }
}

# Bad: Large payloads
message = {
    "file_content": base64.encode(large_file)  # Use URL reference instead
}
```

### Idempotent Consumers

```python
async def idempotent_handler(message: dict):
    """Process message only if not already processed."""
    event_id = message["event_id"]

    # Check if already processed
    if await redis.get(f"processed:{event_id}"):
        logger.info(f"Skipping duplicate: {event_id}")
        return

    # Process message
    await process_order(message["data"])

    # Mark as processed (with TTL for cleanup)
    await redis.setex(f"processed:{event_id}", 86400, "1")
```

### Connection Management

```python
class RabbitMQConnection:
    """Robust connection with automatic reconnection."""

    def __init__(self, url: str):
        self.url = url
        self._connection = None
        self._channel = None

    async def connect(self):
        self._connection = await aio_pika.connect_robust(
            self.url,
            connection_class=aio_pika.RobustConnection,
            reconnect_interval=5,
            fail_fast=False
        )
        self._connection.add_close_callback(self._on_close)
        self._channel = await self._connection.channel()

    def _on_close(self, *args):
        logger.warning("RabbitMQ connection closed, will reconnect")

    async def close(self):
        if self._connection:
            await self._connection.close()
```
