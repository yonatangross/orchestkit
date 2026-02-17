---
title: Enforcing Business Invariants
impact: HIGH
impactDescription: "Unenforced invariants allow invalid domain state — data corruption that propagates through the system silently"
tags: invariant, business-rule, validation, specification, ddd
---

## Enforcing Business Invariants

The aggregate root is responsible for enforcing all business rules before allowing state transitions. Invariants must be checked on every mutation.

### Invariant Enforcement Pattern

```python
from dataclasses import dataclass, field
from uuid import UUID

@dataclass
class OrderAggregate:
    MAX_ITEMS = 100

    id: UUID
    _items: list["OrderItem"] = field(default_factory=list)
    status: str = "draft"
    _events: list["DomainEvent"] = field(default_factory=list)

    def add_item(self, product_id: UUID, quantity: int, price: "Money") -> None:
        """Add item with invariant checks."""
        self._ensure_modifiable()
        if len(self._items) >= self.MAX_ITEMS:
            raise DomainError("Max items exceeded")
        if quantity <= 0:
            raise DomainError("Quantity must be positive")
        self._items.append(OrderItem(product_id, quantity, price))

    def submit(self) -> None:
        """Submit with business rule validation."""
        self._ensure_modifiable()
        if not self._items:
            raise DomainError("Cannot submit empty order")
        self.status = "submitted"
        self._events.append(OrderSubmitted(self.id))

    def _ensure_modifiable(self) -> None:
        if self.status != "draft":
            raise DomainError(f"Cannot modify {self.status} order")
```

### Specification Pattern for Complex Invariants

```python
from abc import ABC, abstractmethod

class Specification(ABC):
    @abstractmethod
    def is_satisfied_by(self, candidate) -> bool: ...

    def and_(self, other: "Specification") -> "Specification":
        return AndSpecification(self, other)

class OverdueOrderSpec(Specification):
    def is_satisfied_by(self, order: Order) -> bool:
        return (
            order.status == "submitted"
            and order.created_at < datetime.now() - timedelta(days=30)
        )

# Usage
overdue = OverdueOrderSpec()
overdue_orders = [o for o in orders if overdue.is_satisfied_by(o)]
```

### Domain Event Collection

```python
@dataclass
class OrderAggregate:
    _events: list["DomainEvent"] = field(default_factory=list)

    def collect_events(self) -> list["DomainEvent"]:
        """Collect and clear events — publish AFTER persist."""
        events = list(self._events)
        self._events.clear()
        return events
```

**Incorrect — no invariant checks, allows invalid state:**
```python
@dataclass
class OrderAggregate:
    id: UUID
    _items: list["OrderItem"] = field(default_factory=list)
    status: str = "draft"

    def add_item(self, product_id: UUID, quantity: int, price: "Money") -> None:
        # No checks! Allows negative quantity, submitted order modification
        self._items.append(OrderItem(product_id, quantity, price))

    def submit(self) -> None:
        # No check for empty order!
        self.status = "submitted"
```

**Correct — enforce invariants on every mutation:**
```python
@dataclass
class OrderAggregate:
    MAX_ITEMS = 100
    id: UUID
    _items: list["OrderItem"] = field(default_factory=list)
    status: str = "draft"

    def add_item(self, product_id: UUID, quantity: int, price: "Money") -> None:
        self._ensure_modifiable()  # Guard clause
        if len(self._items) >= self.MAX_ITEMS:
            raise DomainError("Max items exceeded")
        if quantity <= 0:
            raise DomainError("Quantity must be positive")
        self._items.append(OrderItem(product_id, quantity, price))

    def submit(self) -> None:
        self._ensure_modifiable()
        if not self._items:
            raise DomainError("Cannot submit empty order")
        self.status = "submitted"

    def _ensure_modifiable(self) -> None:
        if self.status != "draft":
            raise DomainError(f"Cannot modify {self.status} order")
```

### Key Rules

- Every mutation method **checks invariants** before modifying state
- Guard clauses at the **top** of every public method
- Use the **specification pattern** for complex, reusable business rules
- Collect domain events in the aggregate, publish **after** successful persistence
- Raise `DomainError` (not generic exceptions) for invariant violations
- Status transitions follow explicit state machine rules
