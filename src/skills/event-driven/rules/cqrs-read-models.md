---
title: "CQRS: Read Models & Query Handlers"
impact: HIGH
impactDescription: "Read models serve all query traffic — poorly designed views cause N+1 queries and stale data issues"
tags: cqrs, read-model, query-handler, projection, denormalization
---

# CQRS: Read Models & Query Handlers

## Architecture Overview

```
+------------------+         +------------------+
|   Write Side     |         |   Read Side      |
+------------------+         +------------------+
|  +-----------+   |         |  +-----------+   |
|  | Commands  |   |         |  |  Queries  |   |
|  +-----+-----+   |         |  +-----+-----+   |
|  +-----v-----+   |         |  +-----v-----+   |
|  | Aggregate |   |         |  |Read Model |   |
|  +-----+-----+   |         |  +-----------+   |
|  +-----v-----+   |         |        ^         |
|  |  Events   |---+---------+--------+         |
|  +-----------+   | Publish |   Project        |
+------------------+         +------------------+
```

## Query Handler

```python
class Query(BaseModel):
    pass

class GetOrderById(Query):
    order_id: UUID

class GetOrdersByCustomer(Query):
    customer_id: UUID
    status: OrderStatus | None = None
    page: int = 1
    page_size: int = 20

class GetOrderByIdHandler:
    def __init__(self, read_db):
        self.db = read_db

    async def handle(self, query: GetOrderById) -> OrderView | None:
        row = await self.db.fetchrow(
            "SELECT * FROM order_summary WHERE id = $1", query.order_id
        )
        return OrderView(**row) if row else None

class OrderView(BaseModel):
    """Denormalized read model for orders."""
    id: UUID
    customer_id: UUID
    customer_name: str  # Denormalized from customer service
    status: str
    total_amount: float
    item_count: int
    created_at: datetime
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Consistency | Eventual consistency between write and read models |
| Event storage | Event store for write side, denormalized tables for read |
| Projection lag | Monitor and alert on projection delay |
| Read model count | Start with one, add more for specific query needs |
| Rebuild strategy | Ability to rebuild projections from events |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER query write model for reads
order = await aggregate_repo.get(order_id)  # WRONG

# CORRECT: Use read model
order = await query_bus.dispatch(GetOrderById(order_id=order_id))

# NEVER modify read model directly
await read_db.execute("UPDATE orders SET status = $1", status)  # WRONG

# CORRECT: Dispatch command, let projection update
await bus.dispatch(UpdateOrderStatus(order_id=order_id, status=status))
```
