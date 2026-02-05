# Eventual Consistency with Domain Events

## When to Use Eventual Consistency

| Immediate (Same Aggregate) | Eventual (Cross-Aggregate) |
|---------------------------|---------------------------|
| Business invariant required | Acceptable delay |
| Same transaction boundary | Different transaction |
| Single aggregate root | Multiple aggregates |
| Synchronous | Asynchronous |

## Pattern: Event-Driven Eventual Consistency

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Order     │     │   Event     │     │  Inventory  │
│  Aggregate  │────▶│   Store     │────▶│  Aggregate  │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      │ Place order       │ OrderPlaced        │ Reserve stock
      │ (immediate)       │ event published    │ (eventual)
      ▼                   ▼                    ▼
   Committed           Persisted           Committed
   in Tx 1             durably             in Tx 2
```

## Implementation

### 1. Order Aggregate (Publisher)

```python
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from uuid_utils import uuid7


@dataclass(frozen=True)
class OrderPlaced:
    """Event published when order is placed."""

    event_id: UUID = field(default_factory=uuid7)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    order_id: UUID = field(default_factory=uuid7)
    customer_id: UUID = field(default_factory=uuid7)
    items: tuple = ()  # (product_id, quantity) tuples


@dataclass
class Order:
    """Order aggregate publishes events for cross-aggregate updates."""

    id: UUID = field(default_factory=uuid7)
    customer_id: UUID = field(default_factory=uuid7)
    items: list["OrderItem"] = field(default_factory=list)
    status: str = "draft"
    _events: list = field(default_factory=list, repr=False)

    def place(self) -> None:
        """Place order - immediate consistency within aggregate."""
        if self.status != "draft":
            raise ValueError("Can only place draft orders")
        if not self.items:
            raise ValueError("Order must have items")

        self.status = "placed"

        # Emit event for cross-aggregate updates (eventual)
        self._events.append(OrderPlaced(
            order_id=self.id,
            customer_id=self.customer_id,
            items=tuple((i.product_id, i.quantity) for i in self.items),
        ))

    def collect_events(self) -> list:
        events = self._events.copy()
        self._events.clear()
        return events
```

### 2. Inventory Aggregate (Subscriber)

```python
@dataclass
class InventoryItem:
    """Inventory aggregate handles stock reservations."""

    id: UUID = field(default_factory=uuid7)
    product_id: UUID = field(default_factory=uuid7)
    available_quantity: int = 0
    reserved_quantity: int = 0

    def reserve(self, quantity: int, order_id: UUID) -> "Reservation":
        """Reserve stock - maintains inventory invariant."""
        if quantity > self.available_quantity:
            raise InsufficientStockError(
                f"Only {self.available_quantity} available"
            )

        self.available_quantity -= quantity
        self.reserved_quantity += quantity

        return Reservation(
            inventory_id=self.id,
            order_id=order_id,
            quantity=quantity,
        )


@dataclass
class Reservation:
    id: UUID = field(default_factory=uuid7)
    inventory_id: UUID = field(default_factory=uuid7)
    order_id: UUID = field(default_factory=uuid7)
    quantity: int = 0
```

### 3. Event Handler (Process Manager)

```python
class OrderPlacedHandler:
    """Handles OrderPlaced events to reserve inventory."""

    def __init__(
        self,
        inventory_repo: "InventoryRepository",
        event_publisher: "EventPublisher",
    ):
        self._inventory = inventory_repo
        self._events = event_publisher

    async def handle(self, event: OrderPlaced) -> None:
        """Process OrderPlaced event."""
        reservations = []

        try:
            for product_id, quantity in event.items:
                inventory = await self._inventory.find_by_product(product_id)
                if not inventory:
                    raise ProductNotFoundError(product_id)

                reservation = inventory.reserve(quantity, event.order_id)
                reservations.append(reservation)
                await self._inventory.update(inventory)

            # Publish success event
            await self._events.publish(InventoryReserved(
                order_id=event.order_id,
                reservations=reservations,
            ))

        except InsufficientStockError as e:
            # Compensate: release any successful reservations
            for reservation in reservations:
                await self._release_reservation(reservation)

            # Publish failure event
            await self._events.publish(InventoryReservationFailed(
                order_id=event.order_id,
                reason=str(e),
            ))

    async def _release_reservation(self, reservation: Reservation) -> None:
        inventory = await self._inventory.get(reservation.inventory_id)
        inventory.release(reservation.quantity)
        await self._inventory.update(inventory)
```

### 4. Saga for Complex Workflows

```python
@dataclass
class OrderSaga:
    """Coordinates eventual consistency across aggregates."""

    order_id: UUID
    status: str = "pending"
    steps_completed: list[str] = field(default_factory=list)

    async def on_order_placed(
        self,
        event: OrderPlaced,
        inventory_service: "InventoryService",
        payment_service: "PaymentService",
    ) -> None:
        """Step 1: Reserve inventory."""
        try:
            await inventory_service.reserve_for_order(event)
            self.steps_completed.append("inventory_reserved")
        except Exception as e:
            await self._compensate(e)
            raise

    async def on_inventory_reserved(
        self,
        event: "InventoryReserved",
        payment_service: "PaymentService",
    ) -> None:
        """Step 2: Process payment."""
        try:
            await payment_service.charge_for_order(event.order_id)
            self.steps_completed.append("payment_processed")
            self.status = "completed"
        except Exception as e:
            await self._compensate(e)
            raise

    async def _compensate(self, error: Exception) -> None:
        """Rollback completed steps in reverse order."""
        self.status = "compensating"

        for step in reversed(self.steps_completed):
            if step == "inventory_reserved":
                await self._release_inventory()
            elif step == "payment_processed":
                await self._refund_payment()

        self.status = "failed"
```

## Idempotency

```python
class IdempotentEventHandler:
    """Ensure events are processed exactly once."""

    def __init__(self, processed_events: "ProcessedEventStore"):
        self._processed = processed_events

    async def handle(self, event: OrderPlaced) -> None:
        """Idempotent event handling."""
        # Check if already processed
        if await self._processed.exists(event.event_id):
            return  # Skip duplicate

        # Process event
        await self._do_handle(event)

        # Mark as processed
        await self._processed.add(event.event_id)

    async def _do_handle(self, event: OrderPlaced) -> None:
        """Actual event handling logic."""
        ...
```
