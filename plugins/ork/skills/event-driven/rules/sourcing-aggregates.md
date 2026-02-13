---
title: "Event-Sourced Aggregates"
impact: HIGH
impactDescription: "Aggregates are the consistency boundary — incorrect apply/raise patterns lead to state corruption and event loss"
tags: aggregate, domain-model, event-sourcing, ddd
---

# Event-Sourced Aggregates

## Aggregate with Apply/Raise Pattern

```python
class Account:
    def __init__(self):
        self._changes, self._version, self.balance = [], 0, 0.0

    def deposit(self, amount: float):
        self._raise_event(MoneyDeposited(aggregate_id=self.id, amount=amount, version=self._version + 1))

    def _apply(self, event):
        match event:
            case MoneyDeposited(): self.balance += event.amount
            case MoneyWithdrawn(): self.balance -= event.amount

    def _raise_event(self, event):
        self._apply(event)
        self._changes.append(event)

    def load_from_history(self, events):
        for e in events: self._apply(e); self._version = e.version
```

## Write Model Aggregate (CQRS)

```python
from dataclasses import dataclass, field

@dataclass
class Order:
    id: UUID
    customer_id: UUID
    items: list[OrderItem]
    status: OrderStatus
    _pending_events: list[DomainEvent] = field(default_factory=list)

    @classmethod
    def create(cls, customer_id: UUID, items: list, shipping_address: Address) -> "Order":
        order = cls(id=uuid4(), customer_id=customer_id, items=[], status=OrderStatus.PENDING)
        for item in items:
            order.items.append(item)
            order._raise_event(OrderItemAdded(order_id=order.id, product_id=item.product_id))
        order._raise_event(OrderCreated(order_id=order.id, customer_id=customer_id))
        return order

    def cancel(self, reason: str):
        if self.status == OrderStatus.SHIPPED:
            raise InvalidOperationError("Cannot cancel shipped order")
        self.status = OrderStatus.CANCELLED
        self._raise_event(OrderCancelled(order_id=self.id, reason=reason))

    def _raise_event(self, event: DomainEvent):
        self._pending_events.append(event)

    @property
    def pending_events(self) -> list[DomainEvent]:
        events = self._pending_events.copy()
        self._pending_events.clear()
        return events
```

## Key Rules

- Separate command methods (deposit, cancel) from apply methods (_apply)
- `_apply` is pure state mutation — no side effects
- `_raise_event` calls `_apply` then appends to uncommitted changes
- `load_from_history` replays events without appending to changes
- Pending events are cleared after persistence (copy-and-clear pattern)

## Anti-Patterns (FORBIDDEN)

```python
# NEVER ignore event ordering
async for event in events:  # May arrive out of order
    await handle(event)  # Must check version/sequence
```
