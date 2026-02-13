---
title: "RabbitMQ Messaging Patterns"
impact: MEDIUM
impactDescription: "RabbitMQ provides flexible routing and reliable task queues — unacknowledged messages and missing DLQ configuration cause silent message loss"
tags: rabbitmq, aio-pika, amqp, exchange, routing, dead-letter-queue, retry
---

# RabbitMQ Messaging Patterns

## RabbitMQ Publisher

```python
import aio_pika
from aio_pika import Message, DeliveryMode

class RabbitMQPublisher:
    def __init__(self, url: str):
        self.url = url
        self._connection = None
        self._channel = None

    async def connect(self):
        self._connection = await aio_pika.connect_robust(self.url)
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=10)

    async def publish(self, exchange: str, routing_key: str, message: dict):
        exchange_obj = await self._channel.get_exchange(exchange)
        await exchange_obj.publish(
            Message(
                body=json.dumps(message).encode(),
                delivery_mode=DeliveryMode.PERSISTENT,
                content_type="application/json"
            ),
            routing_key=routing_key
        )
```

## RabbitMQ Consumer with Retry

```python
class RabbitMQConsumer:
    async def consume(self, queue_name: str, handler, max_retries: int = 3):
        queue = await self._channel.get_queue(queue_name)
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process(requeue=False):
                    try:
                        body = json.loads(message.body.decode())
                        await handler(body)
                    except Exception as e:
                        retry_count = message.headers.get("x-retry-count", 0)
                        if retry_count < max_retries:
                            await self.publish(exchange, routing_key, body,
                                headers={"x-retry-count": retry_count + 1})
                        else:
                            await self.publish("dlx", "failed", body,
                                headers={"x-error": str(e)})
```

## When to Choose RabbitMQ

| Criteria | RabbitMQ |
|----------|----------|
| Throughput | ~50K msg/s |
| Ordering | Queue-level |
| Persistence | Good |
| Best for | Task queues, RPC, complex routing |

## Key Features

- **Exchange types**: direct, topic, fanout, headers
- **Dead letter exchange (DLX)**: Route failed messages for inspection
- **Priority queues**: Process high-priority messages first
- **QoS/prefetch**: Control flow to consumers

## Anti-Patterns (FORBIDDEN)

```python
# NEVER use sync calls in handlers
def handle(msg):
    requests.post(url, data=msg)  # Blocks event loop!

# NEVER skip dead letter handling
except Exception:
    pass  # Failed messages vanish!

# NEVER store large payloads
await publish("files", {"content": large_bytes})  # Use URL reference!
```
