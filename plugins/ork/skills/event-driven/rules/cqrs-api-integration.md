---
title: "CQRS: FastAPI Integration"
impact: HIGH
impactDescription: "API layer bridges HTTP to CQRS — mixing command/query concerns at the API level negates CQRS benefits"
tags: cqrs, fastapi, api, rest, command-dispatch, query-dispatch
---

# CQRS: FastAPI Integration

## FastAPI Endpoints with Command/Query Separation

```python
from fastapi import FastAPI, Depends, HTTPException

app = FastAPI()

@app.post("/api/v1/orders", status_code=201)
async def create_order(request: CreateOrderRequest, bus: CommandBus = Depends(get_command_bus)):
    command = CreateOrder(
        customer_id=request.customer_id,
        items=request.items,
        shipping_address=request.shipping_address,
    )
    try:
        events = await bus.dispatch(command)
        return {"order_id": events[0].order_id}
    except InsufficientInventoryError as e:
        raise HTTPException(400, f"Insufficient inventory: {e}")

@app.get("/api/v1/orders/{order_id}")
async def get_order(order_id: UUID, bus: QueryBus = Depends(get_query_bus)):
    order = await bus.dispatch(GetOrderById(order_id=order_id))
    if not order:
        raise HTTPException(404, "Order not found")
    return order
```

## Key Rules

- POST/PUT/DELETE endpoints dispatch **commands** via CommandBus
- GET endpoints dispatch **queries** via QueryBus
- Never mix command and query in a single endpoint
- Handle eventual consistency — read may not reflect recent write
- Return command result (e.g., created ID), not full read model

## Eventual Consistency Handling

- Accept that GET after POST may not reflect the write immediately
- Use 202 Accepted for async commands that take time to process
- Provide polling endpoint or WebSocket for write completion notification
- Document eventual consistency behavior in API contracts

## Anti-Patterns (FORBIDDEN)

```python
# NEVER query write model in GET endpoint
@app.get("/orders/{id}")
async def get_order(id: UUID, repo=Depends(get_aggregate_repo)):
    return await repo.get(id)  # WRONG: bypasses read model

# NEVER modify state in GET endpoint
@app.get("/orders/{id}/summary")
async def get_summary(id: UUID):
    await update_view_count(id)  # Side effect in GET!
```
