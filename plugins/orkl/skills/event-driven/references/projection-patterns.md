# Projection Patterns

Event-to-read-model projections for CQRS systems.

## Projection Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│ Event Store │────>│  Projector  │────>│   Read Model    │
└─────────────┘     └─────────────┘     └─────────────────┘
       │                  │                     │
       │            ┌─────▼─────┐         ┌─────▼─────┐
       │            │Checkpoint │         │  Indexes  │
       │            └───────────┘         └───────────┘
       │
       └─────────────────────────────────────────────────┐
                                                         │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐ │
│ Analytics   │     │   Search    │     │   Cache     │ │
│  Projection │     │  Projection │     │  Projection │ │
└─────────────┘     └─────────────┘     └─────────────┘ │
       ▲                  ▲                   ▲         │
       └──────────────────┴───────────────────┴─────────┘
```

## Projection Base Class

```python
from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

class Projection(ABC):
    """Base class for all projections."""

    projection_name: str  # Unique identifier

    @abstractmethod
    async def handle(self, event: "DomainEvent") -> None:
        """Process a single event (must be idempotent)."""
        pass

    @abstractmethod
    async def reset(self) -> None:
        """Clear all data for rebuild."""
        pass


class OrderSummaryProjection(Projection):
    """Maintains denormalized order summary for fast queries."""

    projection_name = "order_summary"

    def __init__(self, session: "AsyncSession", services: "ServiceContainer"):
        self.session = session
        self.customers = services.customer_service
        self.products = services.product_service

    async def handle(self, event: "DomainEvent") -> None:
        handler = getattr(self, f"_on_{event.event_type}", None)
        if handler:
            await handler(event)

    async def _on_OrderCreated(self, event: "OrderCreated") -> None:
        # Fetch denormalized data
        customer = await self.customers.get(event.customer_id)

        # Upsert for idempotency
        await self.session.execute(
            insert(order_summary).values(
                id=event.aggregate_id,
                customer_id=event.customer_id,
                customer_name=customer.name,
                customer_email=customer.email,
                status="pending",
                total_amount=0.0,
                item_count=0,
                shipping_address=event.shipping_address.model_dump(),
                created_at=event.timestamp,
                updated_at=event.timestamp,
                event_version=event.version,
            ).on_conflict_do_update(
                index_elements=["id"],
                set_={
                    "status": "pending",
                    "updated_at": event.timestamp,
                    "event_version": event.version,
                },
                where=order_summary.c.event_version < event.version,
            )
        )

    async def _on_OrderItemAdded(self, event: "OrderItemAdded") -> None:
        product = await self.products.get(event.product_id)
        subtotal = event.quantity * event.unit_price

        # Insert item (idempotent with composite key)
        await self.session.execute(
            insert(order_items).values(
                order_id=event.aggregate_id,
                product_id=event.product_id,
                product_name=product.name,
                quantity=event.quantity,
                unit_price=event.unit_price,
                subtotal=subtotal,
            ).on_conflict_do_update(
                index_elements=["order_id", "product_id"],
                set_={
                    "quantity": event.quantity,
                    "subtotal": subtotal,
                },
            )
        )

        # Update summary totals
        await self.session.execute(
            update(order_summary)
            .where(order_summary.c.id == event.aggregate_id)
            .where(order_summary.c.event_version < event.version)
            .values(
                total_amount=order_summary.c.total_amount + subtotal,
                item_count=order_summary.c.item_count + 1,
                updated_at=event.timestamp,
                event_version=event.version,
            )
        )

    async def _on_OrderCompleted(self, event: "OrderCompleted") -> None:
        await self.session.execute(
            update(order_summary)
            .where(order_summary.c.id == event.aggregate_id)
            .where(order_summary.c.event_version < event.version)
            .values(
                status="completed",
                completed_at=event.timestamp,
                updated_at=event.timestamp,
                event_version=event.version,
            )
        )

    async def reset(self) -> None:
        await self.session.execute(delete(order_items))
        await self.session.execute(delete(order_summary))
```

## Projection Runner (Async)

```python
import asyncio
from contextlib import aclosing

class ProjectionRunner:
    """Runs projections from event stream with checkpointing."""

    def __init__(
        self,
        event_store: "EventStore",
        checkpoint_store: "CheckpointStore",
        projections: list[Projection],
    ):
        self.event_store = event_store
        self.checkpoints = checkpoint_store
        self.projections = {p.projection_name: p for p in projections}

    async def run_forever(self, batch_size: int = 100) -> None:
        """Continuously process new events."""
        while True:
            processed = await self._process_batch(batch_size)
            if processed == 0:
                await asyncio.sleep(0.1)  # No new events, wait

    async def _process_batch(self, batch_size: int) -> int:
        processed = 0

        for name, projection in self.projections.items():
            checkpoint = await self.checkpoints.get(name)
            events = await self.event_store.get_events_after(
                checkpoint, limit=batch_size
            )

            for event in events:
                try:
                    await projection.handle(event)
                    await self.checkpoints.update(name, event.event_id)
                    processed += 1
                except Exception as e:
                    logger.error(
                        f"Projection {name} failed on event {event.event_id}: {e}"
                    )
                    # Continue with other projections

        return processed

    async def rebuild(self, projection_name: str) -> int:
        """Rebuild a single projection from scratch."""
        projection = self.projections.get(projection_name)
        if not projection:
            raise ValueError(f"Unknown projection: {projection_name}")

        logger.info(f"Rebuilding projection: {projection_name}")

        # Reset projection data
        await projection.reset()
        await self.checkpoints.reset(projection_name)

        # Replay all events
        count = 0
        async with aclosing(self.event_store.stream_all()) as stream:
            async for event in stream:
                await projection.handle(event)
                count += 1
                if count % 1000 == 0:
                    await self.checkpoints.update(projection_name, event.event_id)
                    logger.info(f"Rebuilt {count} events...")

        await self.checkpoints.update(projection_name, event.event_id)
        logger.info(f"Rebuild complete: {count} events processed")
        return count
```

## Checkpoint Store

```python
from datetime import datetime, timezone

class CheckpointStore:
    def __init__(self, session: "AsyncSession"):
        self.session = session

    async def get(self, projection_name: str) -> UUID | None:
        result = await self.session.execute(
            select(projection_checkpoints.c.last_event_id)
            .where(projection_checkpoints.c.projection_name == projection_name)
        )
        row = result.scalar_one_or_none()
        return row

    async def update(self, projection_name: str, event_id: UUID) -> None:
        await self.session.execute(
            insert(projection_checkpoints).values(
                projection_name=projection_name,
                last_event_id=event_id,
                last_processed_at=datetime.now(timezone.utc),
            ).on_conflict_do_update(
                index_elements=["projection_name"],
                set_={
                    "last_event_id": event_id,
                    "last_processed_at": datetime.now(timezone.utc),
                },
            )
        )

    async def reset(self, projection_name: str) -> None:
        await self.session.execute(
            delete(projection_checkpoints)
            .where(projection_checkpoints.c.projection_name == projection_name)
        )
```

## Multiple Read Model Strategy

| Read Model | Purpose | Update Strategy |
|------------|---------|-----------------|
| OrderSummary | List views | Immediate |
| OrderDetail | Single order | Immediate |
| OrderAnalytics | Reporting | Batch (hourly) |
| OrderSearch | Full-text | Near real-time |

## Anti-Patterns

```python
# WRONG: Not idempotent - fails on replay
await session.execute(insert(table).values(...))

# CORRECT: Idempotent with upsert
await session.execute(
    insert(table).values(...).on_conflict_do_update(...)
)

# WRONG: No version check - out-of-order events corrupt data
await session.execute(update(table).values(status=event.status))

# CORRECT: Version guard
await session.execute(
    update(table)
    .where(table.c.event_version < event.version)
    .values(status=event.status, event_version=event.version)
)
```
