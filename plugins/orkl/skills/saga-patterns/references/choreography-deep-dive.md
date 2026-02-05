# Saga Choreography Deep Dive

Event-driven saga coordination without a central orchestrator.

## When to Use Choreography

- Simple, parallel workflows with few steps
- Services already have event infrastructure
- Team wants loose coupling between services
- No complex conditional logic required
- Each service owns its domain completely

## Architecture (2026 Best Practices)

```
+---------------+          +---------------+          +---------------+
| Order Service |          |Inventory Svc  |          | Payment Svc   |
+-------+-------+          +-------+-------+          +-------+-------+
        |                          |                          |
        | OrderCreated             |                          |
        +------------------------->+                          |
        |                          | InventoryReserved        |
        |                          +------------------------->+
        |                          |                          |
        |                          |          PaymentCompleted|
        |<-------------------------+--------------------------+
        |                          |                          |
        | OrderCompleted           |                          |
        +------------------------->+------------------------->+
```

## Event Contract Design

Define clear event schemas with versioning:

```python
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from uuid import UUID

class SagaEventBase(BaseModel):
    """Base for all saga events."""
    event_id: UUID = Field(default_factory=uuid4)
    saga_id: UUID  # Correlation ID across services
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: str = "1.0"

class InventoryReserved(SagaEventBase):
    """Published by Inventory Service."""
    event_type: str = "inventory.reserved.v1"
    order_id: UUID
    reservation_id: UUID
    items: list[dict]
    expires_at: datetime  # Reservation timeout

class InventoryReservationFailed(SagaEventBase):
    """Published by Inventory Service on failure."""
    event_type: str = "inventory.reservation_failed.v1"
    order_id: UUID
    reason: str
    unavailable_items: list[dict]
```

## Saga Correlation

**CRITICAL**: Include saga_id in all events for tracing:

```python
class SagaCorrelation:
    """Track saga state across choreographed events."""

    def __init__(self, redis: Redis):
        self.redis = redis

    async def start_saga(self, saga_id: UUID, saga_type: str) -> None:
        """Initialize saga correlation tracking."""
        await self.redis.hset(
            f"saga:{saga_id}",
            mapping={
                "type": saga_type,
                "status": "started",
                "started_at": datetime.now(timezone.utc).isoformat(),
                "completed_steps": "[]",
            },
        )
        await self.redis.expire(f"saga:{saga_id}", 86400)  # 24h TTL

    async def record_step(self, saga_id: UUID, step: str, status: str) -> None:
        """Record step completion for correlation."""
        steps = json.loads(await self.redis.hget(f"saga:{saga_id}", "completed_steps") or "[]")
        steps.append({"step": step, "status": status, "at": datetime.now(timezone.utc).isoformat()})
        await self.redis.hset(f"saga:{saga_id}", "completed_steps", json.dumps(steps))

    async def is_step_completed(self, saga_id: UUID, step: str) -> bool:
        """Check if step already completed (idempotency)."""
        steps = json.loads(await self.redis.hget(f"saga:{saga_id}", "completed_steps") or "[]")
        return any(s["step"] == step and s["status"] == "completed" for s in steps)
```

## Compensation in Choreography

Each service listens for failure events and compensates:

```python
class InventoryService:
    @event_handler("payment.failed")
    async def handle_payment_failed(self, event: PaymentFailed):
        """Compensate: release reserved inventory."""
        if await self.correlation.is_step_completed(event.saga_id, "inventory_released"):
            return  # Already compensated (idempotent)

        await self.inventory_repo.release_reservation(event.reservation_id)
        await self.correlation.record_step(event.saga_id, "inventory_released", "completed")

        await self.publisher.publish(InventoryReleased(
            saga_id=event.saga_id,
            reservation_id=event.reservation_id,
        ))
```

## Dead Letter Handling

Handle events that repeatedly fail:

```python
class ChoreographyDLQHandler:
    """Process failed saga events from DLQ."""

    async def handle_dlq_event(self, event: dict, error: str, retry_count: int):
        """Store failed event for manual review or compensation."""
        await self.db.execute(
            insert(failed_saga_events).values(
                saga_id=event["saga_id"],
                event_type=event["event_type"],
                payload=event,
                error=error,
                retry_count=retry_count,
                requires_manual_review=retry_count >= 3,
            )
        )

        if retry_count >= 3:
            # Alert operations team
            await self.alerting.send(
                channel="saga-failures",
                message=f"Saga {event['saga_id']} requires manual intervention",
            )
```

## Key Patterns

| Pattern | Description |
|---------|-------------|
| Saga correlation ID | Track events across services |
| Event versioning | Schema evolution support |
| Idempotent handlers | Safe event reprocessing |
| Reservation timeouts | Auto-release stuck reservations |
| DLQ monitoring | Catch and alert on failures |
