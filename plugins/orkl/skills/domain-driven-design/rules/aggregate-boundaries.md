---
title: Aggregate Root Boundaries and Consistency
impact: HIGH
impactDescription: "Wrong aggregate boundaries cause data corruption — multiple transactions modifying shared state leads to inconsistency"
tags: aggregate, root, boundary, consistency, transactional, ddd
---

## Aggregate Root Boundaries and Consistency

Aggregates define transactional consistency boundaries. The root controls all access to children and enforces the one-aggregate-per-transaction rule.

### Four Core Rules

1. **Root controls access** — External code only references aggregate root
2. **Transactional boundary** — One aggregate per transaction
3. **Reference by ID** — Never hold object references to other aggregates
4. **Invariants enforced** — Root ensures all business rules before state changes

### Correct — Aggregate Root Pattern

```python
from dataclasses import dataclass, field
from uuid import UUID
from uuid_utils import uuid7

@dataclass
class OrderAggregate:
    """Aggregate root — all access goes through here."""

    id: UUID = field(default_factory=uuid7)
    customer_id: UUID  # Reference by ID, not Customer object!
    _items: list["OrderItem"] = field(default_factory=list)
    status: str = "draft"

    @property
    def items(self) -> tuple["OrderItem", ...]:
        return tuple(self._items)  # Expose immutable view

    def add_item(self, product_id: UUID, quantity: int, price: "Money") -> None:
        self._ensure_modifiable()
        if len(self._items) >= self.MAX_ITEMS:
            raise DomainError("Max items exceeded")
        self._items.append(OrderItem(product_id, quantity, price))
```

### Incorrect — Cross-Aggregate References

```python
# NEVER reference aggregates by object
@dataclass
class Order:
    customer: Customer  # WRONG — holds object reference
    # Correct: customer_id: UUID

# NEVER modify multiple aggregates in one transaction
def submit_order(order, inventory):
    order.submit()
    inventory.reserve(order.items)  # WRONG — two aggregates in one tx
    # Correct: use domain events for cross-aggregate coordination

# NEVER expose mutable collections
def items(self) -> list:
    return self._items  # WRONG — caller can mutate
    # Correct: return tuple(self._items)
```

### Key Rules

- External code accesses children **only** through the aggregate root
- Cross-aggregate coordination uses **domain events**, not shared transactions
- Reference other aggregates by **ID**, never by object
- Expose collections as **immutable views** (tuple, frozenset)
- One aggregate = one repository = one transaction boundary
