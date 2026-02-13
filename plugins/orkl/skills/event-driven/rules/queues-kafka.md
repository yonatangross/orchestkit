---
title: "Kafka Streaming Patterns"
impact: MEDIUM
impactDescription: "Kafka is the backbone for high-throughput event streaming — incorrect consumer configuration leads to message loss or duplicate processing"
tags: kafka, aiokafka, producer, consumer, partition, consumer-group, exactly-once
---

# Kafka Streaming Patterns

## FastStream: Unified API (Recommended)

```python
# pip install faststream[kafka,rabbit,redis]
from faststream import FastStream
from faststream.kafka import KafkaBroker
from pydantic import BaseModel

broker = KafkaBroker("localhost:9092")
app = FastStream(broker)

class OrderCreated(BaseModel):
    order_id: str
    customer_id: str
    total: float

@broker.subscriber("orders.created")
async def handle_order(event: OrderCreated):
    """Automatic Pydantic validation and deserialization."""
    print(f"Processing order {event.order_id}")
    await process_order(event)

@broker.publisher("orders.processed")
async def publish_processed(order_id: str) -> dict:
    return {"order_id": order_id, "status": "processed"}

# Run with: faststream run app:app
```

## Kafka Producer (aiokafka)

```python
from aiokafka import AIOKafkaProducer
import json

class KafkaPublisher:
    def __init__(self, bootstrap_servers: str):
        self.bootstrap_servers = bootstrap_servers
        self._producer: AIOKafkaProducer | None = None

    async def start(self):
        self._producer = AIOKafkaProducer(
            bootstrap_servers=self.bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode(),
            acks="all",  # Wait for all replicas
            enable_idempotence=True,  # Exactly-once semantics
        )
        await self._producer.start()

    async def publish(self, topic: str, value: dict, key: str | None = None):
        await self._producer.send_and_wait(
            topic,
            value=value,
            key=key.encode() if key else None,
        )

    async def stop(self):
        await self._producer.stop()
```

## Kafka Consumer with Consumer Group

```python
from aiokafka import AIOKafkaConsumer

class KafkaConsumer:
    def __init__(self, topic: str, group_id: str, bootstrap_servers: str):
        self.consumer = AIOKafkaConsumer(
            topic,
            bootstrap_servers=bootstrap_servers,
            group_id=group_id,
            auto_offset_reset="earliest",
            enable_auto_commit=False,  # Manual commit for reliability
            value_deserializer=lambda v: json.loads(v.decode()),
        )

    async def consume(self, handler):
        await self.consumer.start()
        try:
            async for msg in self.consumer:
                try:
                    await handler(msg.value, msg.key, msg.partition)
                    await self.consumer.commit()
                except Exception as e:
                    await self.send_to_dlq(msg, e)
        finally:
            await self.consumer.stop()
```

## When to Choose Kafka

| Criteria | Kafka |
|----------|-------|
| Throughput | 100K+ msg/s |
| Ordering | Partition-level |
| Persistence | Excellent (configurable retention) |
| Best for | Event streaming, logs, high-volume |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER process without acknowledgment
async for msg in consumer:
    process(msg)  # Message lost on failure!

# NEVER ignore ordering when required
await publish("orders", {"order_id": "123"})  # No partition key!

# NEVER choose Kafka for simple task queue
# RabbitMQ or Redis is simpler for work distribution
```
