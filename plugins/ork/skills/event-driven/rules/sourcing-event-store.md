---
title: "Event Store: Append-Only Persistence"
impact: HIGH
impactDescription: "Event stores are the foundation of event sourcing — incorrect concurrency or mutability breaks audit trails and state reconstruction"
tags: event-store, append-only, optimistic-concurrency, event-versioning
---

# Event Store: Append-Only Persistence

## Domain Event Base

```python
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from uuid import UUID, uuid4

class DomainEvent(BaseModel):
    event_id: UUID = Field(default_factory=uuid4)
    aggregate_id: UUID
    event_type: str
    version: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    class Config:
        frozen = True  # Events are immutable
```

## Event Store Append with Optimistic Concurrency

```python
async def append_events(self, aggregate_id: UUID, events: list, expected_version: int):
    current = await self.get_version(aggregate_id)
    if current != expected_version:
        raise ConcurrencyError(f"Expected {expected_version}, got {current}")
    for event in events:
        await self.session.execute(insert(event_store).values(
            event_id=event.event_id, aggregate_id=aggregate_id,
            event_type=event.event_type, version=event.version, data=event.model_dump()
        ))
```

## Key Rules

| Rule | Detail |
|------|--------|
| Event naming | Past tense (`OrderPlaced`, not `PlaceOrder`) |
| Concurrency | Optimistic locking with version check on append |
| Immutability | Events are frozen — NEVER modify stored events |
| Schema evolution | Version events, support upcasting for old formats |
| Storage | PostgreSQL + JSONB or dedicated event store (EventStoreDB) |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER modify stored events — destroys audit trail
await event_store.update(event_id, new_data)

# NEVER include computed data in events
class OrderPlaced(DomainEvent):
    total: float  # WRONG - compute from line items

# ALWAYS version your events
event_schema_version: int = 1  # Support schema evolution
```
