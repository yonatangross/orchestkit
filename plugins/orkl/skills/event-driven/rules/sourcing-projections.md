---
title: "Projections & Snapshots"
impact: HIGH
impactDescription: "Projections create the read-side views — non-idempotent projections cause data corruption on replay"
tags: projection, read-model, snapshot, upcasting, denormalization
---

# Projections & Snapshots

## Event Projection to Read Model

```python
class OrderProjection:
    """Projects events to read models."""
    def __init__(self, read_db, customer_service):
        self.db = read_db
        self.customers = customer_service

    async def handle(self, event: DomainEvent):
        match event:
            case OrderCreated():
                await self._on_order_created(event)
            case OrderItemAdded():
                await self._on_item_added(event)
            case OrderCancelled():
                await self._on_order_cancelled(event)

    async def _on_order_created(self, event: OrderCreated):
        customer = await self.customers.get(event.customer_id)
        await self.db.execute(
            """INSERT INTO order_summary (id, customer_id, customer_name, status, total_amount, item_count, created_at)
               VALUES ($1, $2, $3, 'pending', 0.0, 0, $4)
               ON CONFLICT (id) DO UPDATE SET customer_name = $3""",
            event.order_id, event.customer_id, customer.name, event.timestamp,
        )

    async def _on_item_added(self, event: OrderItemAdded):
        subtotal = event.quantity * event.unit_price
        await self.db.execute(
            "UPDATE order_summary SET total_amount = total_amount + $1, item_count = item_count + 1 WHERE id = $2",
            subtotal, event.order_id,
        )

    async def _on_order_cancelled(self, event: OrderCancelled):
        await self.db.execute(
            "UPDATE order_summary SET status = 'cancelled' WHERE id = $1", event.order_id
        )
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Snapshots | Every 100-500 events for large aggregates |
| Projections | Async handlers, idempotent updates (UPSERT) |
| Projection lag | Monitor and alert on delay between write and read |
| Rebuild strategy | Ability to rebuild all projections from event stream |
| Read model count | Start with one, add more for specific query needs |

## Snapshot Strategy

- Take snapshots after every N events (100-500 depending on aggregate size)
- Load latest snapshot + events after snapshot version for fast aggregate hydration
- Balance snapshot frequency vs storage cost

## Anti-Patterns (FORBIDDEN)

```python
# NEVER skip projection idempotency — use UPSERT
await self.db.execute("INSERT INTO ...")  # Fails on replay!

# CORRECT: Always use ON CONFLICT
await self.db.execute("INSERT INTO ... ON CONFLICT (id) DO UPDATE SET ...")

# NEVER modify read model directly — let projections handle it
await read_db.execute("UPDATE orders SET status = $1", status)  # WRONG
```
