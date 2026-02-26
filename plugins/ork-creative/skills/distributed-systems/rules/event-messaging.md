---
title: Guarantee at-least-once delivery using transactional outbox and event messaging patterns
impact: HIGH
impactDescription: "Publishing events without transactional outbox causes lost messages on failures — the outbox pattern guarantees at-least-once delivery"
tags: message-queue, kafka, rabbitmq, outbox, saga, event-driven
---

## Event Messaging & Outbox

Reliable event publishing with transactional outbox, saga orchestration, and message queue patterns.

**Incorrect — dual-write without outbox (data loss on failure):**
```python
# WRONG: If publish fails, DB has data but event is lost
async def create_order(order: Order):
    await db.insert(order)              # Step 1: succeeds
    await message_broker.publish(        # Step 2: might fail!
        "order.created", order.dict()
    )
    # If publish fails: order exists but no event was sent
    # Downstream services never know about the order
```

**Correct — transactional outbox pattern:**
```python
# Outbox table: events written atomically with business data
async def create_order(order: Order, db: AsyncSession):
    async with db.begin():
        # Both in same transaction — atomic!
        db.add(order)
        db.add(OutboxEvent(
            aggregate_id=order.id,
            event_type="order.created",
            payload=order.dict(),
            created_at=datetime.utcnow(),
        ))

# Outbox publisher (separate process, polls for unsent events)
async def publish_outbox_events(db: AsyncSession, broker: MessageBroker):
    while True:
        async with db.begin():
            events = await db.execute(
                select(OutboxEvent)
                .where(OutboxEvent.published_at.is_(None))
                .order_by(OutboxEvent.created_at)
                .limit(100)
                .with_for_update(skip_locked=True)  # Concurrent workers safe
            )
            for event in events.scalars():
                await broker.publish(event.event_type, event.payload)
                event.published_at = datetime.utcnow()
        await asyncio.sleep(1)
```

**Saga orchestration pattern:**
```python
class OrderSaga:
    steps = [
        SagaStep("reserve_inventory", compensate="release_inventory"),
        SagaStep("charge_payment", compensate="refund_payment"),
        SagaStep("ship_order", compensate="cancel_shipment"),
    ]

    async def execute(self, order_id: str):
        completed = []
        for step in self.steps:
            try:
                await step.execute(order_id)
                completed.append(step)
            except Exception:
                # Compensate in reverse order
                for s in reversed(completed):
                    await s.compensate(order_id)
                raise SagaFailed(f"Failed at {step.name}")
```

**Idempotent consumer (prevents duplicate processing):**
```python
async def handle_event(event: Event, db: AsyncSession):
    async with db.begin():
        # Check if already processed
        exists = await db.execute(
            select(ProcessedEvent).where(ProcessedEvent.event_id == event.id)
        )
        if exists.scalar():
            return  # Already processed, skip

        # Process the event
        await process_order(event.payload)

        # Mark as processed
        db.add(ProcessedEvent(event_id=event.id, processed_at=datetime.utcnow()))
```

**Key rules:**
- Use transactional outbox to atomically save data and events
- All saga steps must have compensating actions
- Every message consumer must be idempotent (use event ID deduplication)
- Use `SKIP LOCKED` for concurrent outbox workers
- Kafka for high-throughput streaming, RabbitMQ for routing, Redis Streams for simplicity
- Use dead letter queues (DLQ) for messages that fail after max retries
