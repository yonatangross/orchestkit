# Kafka Patterns

## Partition Key Selection

```python
# Use aggregate ID for ordered events within same entity
await producer.publish(
    topic="orders",
    key=str(order.id),  # All order events on same partition
    value=event,
)

# Use customer ID for customer-centric ordering
await producer.publish(
    topic="customer-events",
    key=str(customer_id),  # All customer events ordered
    value=event,
)

# Use random key for maximum parallelism (no ordering)
import uuid
await producer.publish(
    topic="logs",
    key=str(uuid.uuid4()),  # Distributed across partitions
    value=log_event,
)
```

## Consumer Group Patterns

```python
from aiokafka import AIOKafkaConsumer

# Multiple consumers in same group = load balancing
consumer1 = AIOKafkaConsumer(
    "orders",
    group_id="order-processors",  # Same group
    bootstrap_servers="localhost:9092",
)

consumer2 = AIOKafkaConsumer(
    "orders",
    group_id="order-processors",  # Same group - partitions split
    bootstrap_servers="localhost:9092",
)

# Different groups = broadcast
analytics_consumer = AIOKafkaConsumer(
    "orders",
    group_id="analytics",  # Different group - gets all messages
    bootstrap_servers="localhost:9092",
)
```

## Exactly-Once Semantics

```python
producer = AIOKafkaProducer(
    bootstrap_servers="localhost:9092",
    acks="all",                    # Wait for all replicas
    enable_idempotence=True,       # Deduplicate on broker
    transactional_id="my-app-1",   # Enable transactions
)

await producer.start()

# Transactional produce
async with producer.transaction():
    await producer.send("topic1", value=b"msg1")
    await producer.send("topic2", value=b"msg2")
    # Both committed atomically or neither
```

## Offset Management

```python
consumer = AIOKafkaConsumer(
    "orders",
    group_id="processors",
    enable_auto_commit=False,  # Manual commit for reliability
    auto_offset_reset="earliest",  # Start from beginning if no offset
)

async for msg in consumer:
    try:
        await process(msg)
        # Commit AFTER successful processing
        await consumer.commit()
    except Exception:
        # Don't commit - message will be reprocessed
        pass
```

## Topic Naming Conventions

```
<domain>.<entity>.<event-type>

Examples:
- orders.order.created
- orders.order.shipped
- customers.customer.registered
- inventory.stock.updated
```
