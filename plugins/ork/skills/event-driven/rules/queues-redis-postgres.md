---
title: "Redis Streams & Postgres Queue Patterns"
impact: MEDIUM
impactDescription: "Redis Streams and Postgres queues offer simpler alternatives to Kafka/RabbitMQ — choosing the wrong tool for the throughput leads to bottlenecks or unnecessary complexity"
tags: redis-streams, postgres-queue, listen-notify, skip-locked, consumer-group, xread
---

# Redis Streams & Postgres Queue Patterns

## Redis Streams Consumer Group

```python
import redis.asyncio as redis

class RedisStreamConsumer:
    def __init__(self, url: str, stream: str, group: str, consumer: str):
        self.redis = redis.from_url(url)
        self.stream, self.group, self.consumer = stream, group, consumer

    async def setup(self):
        try:
            await self.redis.xgroup_create(self.stream, self.group, "0", mkstream=True)
        except redis.ResponseError as e:
            if "BUSYGROUP" not in str(e): raise

    async def consume(self, handler):
        while True:
            messages = await self.redis.xreadgroup(
                groupname=self.group, consumername=self.consumer,
                streams={self.stream: ">"}, count=10, block=5000
            )
            for stream, stream_messages in messages:
                for message_id, data in stream_messages:
                    try:
                        await handler(message_id, data)
                        await self.redis.xack(self.stream, self.group, message_id)
                    except Exception:
                        pass  # Message redelivered on restart
```

## "Just Use Postgres" Pattern

```python
from sqlalchemy import text

class PostgresQueue:
    """Simple queue using Postgres — good for moderate throughput."""

    async def publish(self, db: AsyncSession, channel: str, payload: dict):
        await db.execute(
            text("SELECT pg_notify(:channel, :payload)"),
            {"channel": channel, "payload": json.dumps(payload)}
        )

    async def get_next_job(self, db: AsyncSession) -> dict | None:
        """Get next job with advisory lock."""
        result = await db.execute(text("""
            SELECT id, payload FROM job_queue
            WHERE status = 'pending'
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        """))
        return result.first()
```

## Technology Decision Flowchart

```
Need > 50K msg/s?
    YES -> Kafka (partitioned, replicated)
    NO  |
        v
Need complex routing (topic, headers)?
    YES -> RabbitMQ (exchanges, bindings)
    NO  |
        v
Need real-time + simple?
    YES -> Redis Streams (XREAD, consumer groups)
    NO  |
        v
Already using Postgres + < 10K msg/s?
    YES -> Postgres (LISTEN/NOTIFY + FOR UPDATE SKIP LOCKED)
    NO  -> Re-evaluate requirements
```

## Technology Comparison

| Technology | Best For | Throughput | Ordering | Persistence |
|------------|----------|------------|----------|-------------|
| **Kafka** | Event streaming, logs, high-volume | 100K+ msg/s | Partition-level | Excellent |
| **RabbitMQ** | Task queues, RPC, routing | ~50K msg/s | Queue-level | Good |
| **Redis Streams** | Real-time, simple streaming | ~100K msg/s | Stream-level | Good (AOF) |
| **Postgres** | Moderate volume, simplicity | ~10K msg/s | Query-defined | Excellent |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER use Redis Streams when strict delivery matters
# Use RabbitMQ or Kafka for guaranteed delivery

# NEVER skip acknowledgment in Redis Streams
await handler(message_id, data)
# Missing XACK — message will be redelivered!

# ALWAYS acknowledge after successful processing
await self.redis.xack(self.stream, self.group, message_id)
```
