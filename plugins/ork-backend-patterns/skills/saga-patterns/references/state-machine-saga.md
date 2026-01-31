# State Machine Saga Implementation

FSM-based saga implementation for explicit state transitions and validation.

## When to Use State Machine Sagas

- Complex workflows with many states and transitions
- Need formal verification of state transitions
- Regulatory requirements for state audit trail
- Business rules depend on current state
- Visual documentation of workflow is valuable

## State Machine Design (2026)

```
                          +----------+
                          |  PENDING |
                          +----+-----+
                               |
                               | start()
                               v
                     +-------------------+
                     | RESERVING_INVENTORY|
                     +--------+----------+
                              |
           +------------------+------------------+
           |                                     |
           | reserved()                          | reservation_failed()
           v                                     v
+-------------------+                    +---------------+
|PROCESSING_PAYMENT |                    |    FAILED     |
+--------+----------+                    +---------------+
         |
    +----+----+
    |         |
    | paid()  | payment_failed()
    v         v
+--------+  +----------------+
|SHIPPING|  |  COMPENSATING  |
+---+----+  +-------+--------+
    |               |
    | shipped()     | compensated()
    v               v
+----------+  +-----------+
| COMPLETED|  |COMPENSATED|
+----------+  +-----------+
```

## Implementation with `transitions` Library

```python
from transitions.extensions.asyncio import AsyncMachine
from transitions.extensions import HierarchicalAsyncMachine
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID
import structlog

logger = structlog.get_logger()

@dataclass
class SagaContext:
    """Saga execution context with state machine."""
    saga_id: UUID
    data: dict = field(default_factory=dict)
    error: str | None = None
    compensations: list[str] = field(default_factory=list)


class OrderSagaFSM:
    """Order saga as finite state machine."""

    states = [
        "pending",
        "reserving_inventory",
        "processing_payment",
        "shipping",
        "completed",
        "compensating",
        "compensated",
        "failed",
    ]

    transitions = [
        # Forward flow
        {
            "trigger": "start",
            "source": "pending",
            "dest": "reserving_inventory",
            "before": "_log_transition",
            "after": "_reserve_inventory",
        },
        {
            "trigger": "inventory_reserved",
            "source": "reserving_inventory",
            "dest": "processing_payment",
            "before": "_log_transition",
            "after": "_process_payment",
        },
        {
            "trigger": "payment_completed",
            "source": "processing_payment",
            "dest": "shipping",
            "before": "_log_transition",
            "after": "_create_shipment",
        },
        {
            "trigger": "shipment_created",
            "source": "shipping",
            "dest": "completed",
            "before": "_log_transition",
            "after": "_send_confirmation",
        },

        # Failure transitions
        {
            "trigger": "reservation_failed",
            "source": "reserving_inventory",
            "dest": "failed",
            "before": "_log_transition",
        },
        {
            "trigger": "payment_failed",
            "source": "processing_payment",
            "dest": "compensating",
            "before": "_log_transition",
            "after": "_compensate_inventory",
        },
        {
            "trigger": "shipment_failed",
            "source": "shipping",
            "dest": "compensating",
            "before": "_log_transition",
            "after": "_compensate_payment_and_inventory",
        },

        # Compensation completion
        {
            "trigger": "compensation_complete",
            "source": "compensating",
            "dest": "compensated",
            "before": "_log_transition",
        },
    ]

    def __init__(self, ctx: SagaContext, services: dict):
        self.ctx = ctx
        self.services = services

        self.machine = AsyncMachine(
            model=self,
            states=self.states,
            transitions=self.transitions,
            initial="pending",
            send_event=True,
        )

    async def _log_transition(self, event):
        """Log all state transitions for audit."""
        logger.info(
            "saga_transition",
            saga_id=str(self.ctx.saga_id),
            from_state=event.transition.source,
            to_state=event.transition.dest,
            trigger=event.event.name,
        )

    async def _reserve_inventory(self, event):
        """Execute inventory reservation."""
        try:
            result = await self.services["inventory"].reserve(
                order_id=self.ctx.data["order_id"],
                items=self.ctx.data["items"],
            )
            self.ctx.data["reservation_id"] = result.id
            self.ctx.compensations.append("inventory")
            await self.inventory_reserved()
        except Exception as e:
            self.ctx.error = str(e)
            await self.reservation_failed()

    async def _process_payment(self, event):
        """Execute payment processing."""
        try:
            result = await self.services["payment"].charge(
                order_id=self.ctx.data["order_id"],
                amount=self.ctx.data["total"],
            )
            self.ctx.data["payment_id"] = result.id
            self.ctx.compensations.append("payment")
            await self.payment_completed()
        except Exception as e:
            self.ctx.error = str(e)
            await self.payment_failed()

    async def _create_shipment(self, event):
        """Execute shipment creation."""
        try:
            result = await self.services["shipping"].create(
                order_id=self.ctx.data["order_id"],
                address=self.ctx.data["shipping_address"],
            )
            self.ctx.data["shipment_id"] = result.id
            self.ctx.data["tracking_number"] = result.tracking
            await self.shipment_created()
        except Exception as e:
            self.ctx.error = str(e)
            await self.shipment_failed()

    async def _send_confirmation(self, event):
        """Send order confirmation (fire-and-forget)."""
        await self.services["notification"].send_confirmation(
            order_id=self.ctx.data["order_id"],
            tracking=self.ctx.data.get("tracking_number"),
        )

    async def _compensate_inventory(self, event):
        """Compensate inventory only."""
        if "inventory" in self.ctx.compensations:
            await self.services["inventory"].release(self.ctx.data["reservation_id"])
        await self.compensation_complete()

    async def _compensate_payment_and_inventory(self, event):
        """Compensate payment and inventory."""
        if "payment" in self.ctx.compensations:
            await self.services["payment"].refund(self.ctx.data["payment_id"])
        if "inventory" in self.ctx.compensations:
            await self.services["inventory"].release(self.ctx.data["reservation_id"])
        await self.compensation_complete()
```

## State Persistence

Persist FSM state for recovery:

```python
class PersistentSagaFSM(OrderSagaFSM):
    """FSM with state persistence."""

    def __init__(self, ctx: SagaContext, services: dict, repo):
        super().__init__(ctx, services)
        self.repo = repo

        # Add persistence callback to all transitions
        self.machine.on_enter_state("*", self._persist_state)

    async def _persist_state(self, event):
        """Persist state after every transition."""
        await self.repo.update_saga_state(
            saga_id=self.ctx.saga_id,
            state=self.state,
            data=self.ctx.data,
            compensations=self.ctx.compensations,
            error=self.ctx.error,
        )

    @classmethod
    async def restore(cls, saga_id: UUID, services: dict, repo) -> "PersistentSagaFSM":
        """Restore FSM from persisted state."""
        record = await repo.get_saga(saga_id)
        ctx = SagaContext(
            saga_id=saga_id,
            data=record.data,
            error=record.error,
            compensations=record.compensations,
        )
        fsm = cls(ctx, services, repo)
        fsm.machine.set_state(record.state)  # Restore to saved state
        return fsm
```

## State Transition Validation

Prevent invalid transitions:

```python
# transitions library automatically validates
# Invalid transition raises MachineError:

try:
    await saga.payment_completed()  # Only valid from processing_payment
except MachineError as e:
    logger.error("Invalid transition", error=str(e))
```

## Key Patterns

| Pattern | Description |
|---------|-------------|
| Explicit states | All states are declared |
| Guard conditions | Validate before transition |
| Entry/exit actions | Execute on state change |
| State persistence | Survive restarts |
| Transition logging | Full audit trail |
