---
title: "Saga Choreography Pattern"
impact: HIGH
impactDescription: "Choreography distributes saga logic across services via events — missing event handlers or compensation events cause silent failures"
tags: saga, choreography, event-driven, distributed, loose-coupling
---

# Saga Choreography Pattern

## Event-Driven Choreography

```python
class OrderChoreography:
    """Event handlers for order saga choreography."""

    def __init__(self, event_bus, order_repo):
        self.bus = event_bus
        self.repo = order_repo

    async def handle_order_created(self, event):
        await self.bus.publish("inventory.reserve.requested", {
            "saga_id": event.saga_id,
            "items": event.payload["order"]["items"],
        })

    async def handle_inventory_reserved(self, event):
        await self.bus.publish("payment.charge.requested", {
            "saga_id": event.saga_id,
            "amount": event.payload["amount"],
        })

    async def handle_payment_failed(self, event):
        # Compensation: release inventory
        await self.bus.publish("inventory.release.requested", {
            "saga_id": event.saga_id,
            "reservation_id": event.payload["reservation_id"],
        })

    async def handle_shipment_created(self, event):
        order = await self.repo.get(event.payload["order_id"])
        order.status = "shipped"
        await self.repo.save(order)
```

## When to Use Choreography vs Orchestration

| Use Choreography When | Use Orchestration When |
|------------------------|------------------------|
| Simple, parallel flows | Complex, ordered workflows |
| Services should remain loosely coupled | Central visibility is required |
| Few steps (2-3 services) | Many steps (4+ services) |
| Each service owns its domain fully | Business process needs coordination |

## Key Rules

- Each service reacts independently to domain events
- Compensation events are published on failure (e.g., `inventory.release.requested`)
- Include `saga_id` in all events for correlation and tracing
- Requires distributed tracing for visibility across services
- Use choreography for simple flows; switch to orchestration when complexity grows

## Anti-Patterns (FORBIDDEN)

```python
# NEVER rely on synchronous calls across services in choreography
async def _reserve_and_pay(self, data: dict):
    await self.inventory.reserve(data)
    await self.payment.charge(data)  # If fails, inventory stuck!

# NEVER skip correlation IDs
await self.bus.publish("payment.charge.requested", {
    "amount": 100,  # Missing saga_id — cannot trace!
})

# ALWAYS include saga_id for cross-service correlation
```
