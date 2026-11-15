---
title: Right-size aggregates to balance lock contention against consistency guarantee requirements
impact: HIGH
impactDescription: "Oversized aggregates cause lock contention and performance degradation — undersized ones lose consistency guarantees"
tags: aggregate, sizing, performance, consistency, split, ddd
---

## Right-Sizing Aggregates

Keep aggregates small. Large aggregates cause lock contention and slow operations. Split when collections grow unbounded or when different parts change at different rates.

### Sizing Guidelines

| Signal | Action |
|--------|--------|
| < 20 children | Keep as single aggregate |
| 20-100 children | Consider splitting by access pattern |
| 100+ children | Must split — use reference by ID |
| Unbounded collection | Always split — never allow unbounded growth |
| Different change rates | Split into separate aggregates |

### Correct — Small, Focused Aggregates

```python
@dataclass
class OrderAggregate:
    """Small aggregate — bounded items list."""
    id: UUID
    customer_id: UUID  # Reference by ID
    _items: list["OrderItem"]  # Bounded: max 100

    MAX_ITEMS = 100

@dataclass
class CustomerAggregate:
    """Separate aggregate — customer has different lifecycle."""
    id: UUID
    name: str
    email: str
    # NO orders list here — unbounded!
```

### Incorrect — Oversized Aggregate

```python
@dataclass
class CustomerAggregate:
    id: UUID
    name: str
    orders: list["Order"]  # WRONG — unbounded growth
    reviews: list["Review"]  # WRONG — different change rate
    notifications: list["Notification"]  # WRONG — unrelated concern
```

### When to Split

1. **Unbounded collections** — If a collection can grow without limit, extract it
2. **Different change rates** — If parts of the aggregate change at different frequencies
3. **Lock contention** — If concurrent modifications frequently conflict
4. **Performance** — If loading the full aggregate is slow

### Cross-Aggregate Consistency

After splitting, use eventual consistency between aggregates:

```python
# Order aggregate publishes event
class OrderSubmitted(DomainEvent):
    order_id: UUID
    customer_id: UUID

# Inventory aggregate handles event (eventually consistent)
class InventoryEventHandler:
    async def handle_order_submitted(self, event: OrderSubmitted) -> None:
        inventory = await self.repo.get_for_order(event.order_id)
        inventory.reserve_items(event.order_id)
        await self.repo.save(inventory)
```

### Key Rules

- Prefer **small aggregates** (< 20 children)
- Never allow **unbounded collections** inside an aggregate
- Use **reference by ID** for cross-aggregate relationships
- Apply **eventual consistency** across aggregate boundaries via domain events
- Split by **change rate** — parts that change together stay together
- Measure **lock contention** — split if concurrent modifications conflict
