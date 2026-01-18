# Event Store Patterns

Detailed implementation guide for event stores with PostgreSQL.

## Event Store Table Design

### Core Schema

```sql
CREATE TABLE event_store (
    -- Identity
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,

    -- Event data
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',

    -- Versioning (critical for optimistic concurrency)
    version INT NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_aggregate_version UNIQUE (aggregate_id, version)
);

-- Essential indexes
CREATE INDEX idx_event_store_aggregate ON event_store (aggregate_id, version);
CREATE INDEX idx_event_store_type ON event_store (event_type);
CREATE INDEX idx_event_store_created ON event_store (created_at);

-- For projections that need to process all events in order
CREATE INDEX idx_event_store_global_position ON event_store (event_id);
```

### Stream Position Tracking (for projections)

```sql
CREATE TABLE projection_checkpoints (
    projection_name VARCHAR(255) PRIMARY KEY,
    last_event_id UUID NOT NULL,
    last_processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    events_processed BIGINT NOT NULL DEFAULT 0
);
```

## Optimistic Concurrency

### The Pattern

```python
from sqlalchemy import select, insert
from sqlalchemy.exc import IntegrityError

class EventStore:
    async def append_events(
        self,
        aggregate_id: UUID,
        events: list[DomainEvent],
        expected_version: int
    ) -> None:
        """
        Append events with optimistic concurrency control.

        Raises ConcurrencyError if another process modified the aggregate.
        """
        async with self.session.begin():
            # Get current version
            current = await self._get_current_version(aggregate_id)

            if current != expected_version:
                raise ConcurrencyError(
                    f"Aggregate {aggregate_id} at version {current}, "
                    f"expected {expected_version}"
                )

            # Append events with sequential versions
            for i, event in enumerate(events):
                event_record = {
                    "event_id": event.event_id,
                    "aggregate_id": aggregate_id,
                    "aggregate_type": event.aggregate_type,
                    "event_type": event.event_type,
                    "event_data": event.model_dump(mode="json"),
                    "version": expected_version + i + 1,
                }
                await self.session.execute(
                    insert(event_store_table).values(**event_record)
                )

    async def _get_current_version(self, aggregate_id: UUID) -> int:
        result = await self.session.execute(
            select(func.max(event_store_table.c.version))
            .where(event_store_table.c.aggregate_id == aggregate_id)
        )
        return result.scalar() or 0
```

### Handling Concurrency Conflicts

```python
async def handle_command_with_retry(
    command: Command,
    max_retries: int = 3
) -> None:
    for attempt in range(max_retries):
        try:
            aggregate = await repository.load(command.aggregate_id)
            aggregate.handle(command)
            await repository.save(aggregate)
            return
        except ConcurrencyError:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(0.1 * (attempt + 1))  # Backoff
```

## Projections and Read Models

### Projection Handler Pattern

```python
class OrderProjection:
    """
    Builds a denormalized read model from order events.
    Idempotent: can replay events safely.
    """

    async def handle(self, event: DomainEvent) -> None:
        match event.event_type:
            case "OrderPlaced":
                await self._on_order_placed(event)
            case "OrderShipped":
                await self._on_order_shipped(event)
            case "OrderCancelled":
                await self._on_order_cancelled(event)

    async def _on_order_placed(self, event: DomainEvent) -> None:
        data = event.event_data
        await self.session.execute(
            insert(orders_read_model).values(
                order_id=event.aggregate_id,
                customer_id=data["customer_id"],
                status="placed",
                total_amount=data["total_amount"],
                placed_at=event.created_at,
                version=event.version
            ).on_conflict_do_nothing()  # Idempotent
        )
```

### Async Projection Processing

```python
class ProjectionProcessor:
    async def run(self, projection_name: str, handler: Callable) -> None:
        checkpoint = await self._get_checkpoint(projection_name)

        async for event in self.event_store.stream_after(checkpoint):
            await handler(event)
            await self._update_checkpoint(projection_name, event.event_id)

    async def rebuild(self, projection_name: str, handler: Callable) -> None:
        """Rebuild projection from scratch."""
        await self._clear_read_model(projection_name)
        await self._reset_checkpoint(projection_name)
        await self.run(projection_name, handler)
```

## Snapshot Strategies

### When to Snapshot

| Aggregate Size | Snapshot Frequency |
|----------------|-------------------|
| < 50 events avg | No snapshots needed |
| 50-200 events | Every 100 events |
| 200-1000 events | Every 200 events |
| > 1000 events | Every 500 events |

### Snapshot Implementation

```python
class SnapshotStore:
    async def save_snapshot(
        self,
        aggregate_id: UUID,
        aggregate_type: str,
        version: int,
        state: dict
    ) -> None:
        await self.session.execute(
            insert(snapshots_table).values(
                aggregate_id=aggregate_id,
                aggregate_type=aggregate_type,
                version=version,
                state=state,
                created_at=datetime.utcnow()
            ).on_conflict_do_update(
                index_elements=["aggregate_id"],
                set_={"version": version, "state": state, "created_at": datetime.utcnow()}
            )
        )

    async def load_with_snapshot(self, aggregate_id: UUID) -> Aggregate:
        # 1. Load latest snapshot
        snapshot = await self._get_snapshot(aggregate_id)

        # 2. Load events after snapshot
        start_version = snapshot.version if snapshot else 0
        events = await self.event_store.get_events(
            aggregate_id, after_version=start_version
        )

        # 3. Reconstruct aggregate
        aggregate = Aggregate()
        if snapshot:
            aggregate.restore_from_snapshot(snapshot.state)
        aggregate.load_from_history(events)

        # 4. Maybe create new snapshot
        if len(events) > 100:
            await self.save_snapshot(
                aggregate_id,
                aggregate.aggregate_type,
                aggregate.version,
                aggregate.get_snapshot_state()
            )

        return aggregate
```

### Snapshot Table Schema

```sql
CREATE TABLE snapshots (
    aggregate_id UUID PRIMARY KEY,
    aggregate_type VARCHAR(255) NOT NULL,
    version INT NOT NULL,
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Event Schema Evolution

### Upcasting Pattern

```python
class EventUpcast:
    """Transform old event schemas to current version."""

    UPCASTERS = {
        ("OrderPlaced", 1, 2): _upcast_order_placed_v1_to_v2,
        ("OrderPlaced", 2, 3): _upcast_order_placed_v2_to_v3,
    }

    def upcast(self, event_type: str, version: int, data: dict) -> dict:
        current_version = version
        target_version = self._get_current_version(event_type)

        while current_version < target_version:
            key = (event_type, current_version, current_version + 1)
            if key in self.UPCASTERS:
                data = self.UPCASTERS[key](data)
            current_version += 1

        return data

def _upcast_order_placed_v1_to_v2(data: dict) -> dict:
    """V1 had 'amount', V2 renamed to 'total_amount'."""
    return {
        **data,
        "total_amount": data.pop("amount"),
        "schema_version": 2
    }
```

## Best Practices

1. **Events are immutable** - Never update or delete events
2. **Use meaningful names** - `OrderShipped` not `OrderEvent3`
3. **Include correlation IDs** - Track request chains across services
4. **Version your schemas** - Plan for evolution from day one
5. **Make projections idempotent** - Use upserts, not inserts
6. **Monitor projection lag** - Alert if projections fall behind
