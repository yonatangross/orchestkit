---
name: aggregate-patterns
description: DDD aggregate design patterns for consistency boundaries and invariants. Use when designing aggregate roots, enforcing business invariants, handling cross-aggregate references, or optimizing aggregate size.
context: fork
agent: backend-system-architect
version: 1.0.0
tags: [ddd, aggregate, consistency, invariants, domain-modeling, python, 2026]
author: SkillForge
user-invocable: false
---

# Aggregate Design Patterns

Design aggregates with clear boundaries, invariants, and consistency guarantees.

## When to Use

- Defining transactional consistency boundaries
- Enforcing business invariants across related entities
- Designing aggregate roots and their children
- Handling references between aggregates
- Optimizing aggregate size for performance

## Aggregate Fundamentals

### What is an Aggregate?

```
+-------------------------------------------------------------------+
|                     Aggregate Structure                            |
+-------------------------------------------------------------------+
|                                                                   |
|   +-------------------------------------------------------+       |
|   |                    ORDER AGGREGATE                     |       |
|   |   +-------------------------------------------+       |       |
|   |   |            Order (Aggregate Root)          |       |       |
|   |   |  - id: UUID                                |       |       |
|   |   |  - status: OrderStatus                     |       |       |
|   |   |  - customer_id: UUID (reference)           |       |       |
|   |   +-------------------------------------------+       |       |
|   |              |                    |                   |       |
|   |              |                    |                   |       |
|   |   +------------------+  +------------------+          |       |
|   |   |   OrderItem      |  |   OrderItem      |          |       |
|   |   |  - product_id    |  |  - product_id    |          |       |
|   |   |  - quantity      |  |  - quantity      |          |       |
|   |   |  - unit_price    |  |  - unit_price    |          |       |
|   |   +------------------+  +------------------+          |       |
|   |                                                       |       |
|   +-------------------------------------------------------+       |
|                                                                   |
|   INVARIANTS:                                                     |
|   1. Order total = sum of all item subtotals                      |
|   2. Order must have at least one item when submitted             |
|   3. Items cannot be modified after order is shipped              |
|   4. Maximum 100 items per order                                  |
|                                                                   |
|   CONSISTENCY BOUNDARY:                                           |
|   - All changes within aggregate are atomic                       |
|   - External references (customer_id) by ID only                  |
|                                                                   |
+-------------------------------------------------------------------+
```

### Aggregate Rules

1. **Root controls access**: Only aggregate root is referenced externally
2. **Transactional consistency**: One aggregate per transaction
3. **Reference by ID**: Reference other aggregates by ID, not object
4. **Invariants enforced**: Root ensures all invariants are maintained

## Designing Aggregate Roots

### Complete Aggregate Root Example

```python
from dataclasses import dataclass, field
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional
from decimal import Decimal

@dataclass
class OrderAggregate:
    """
    Aggregate Root: Controls all access to Order and OrderItems.

    Responsibilities:
    1. Enforce invariants (max items, valid transitions)
    2. Coordinate changes to child entities
    3. Emit domain events
    4. Provide transactional boundary
    """

    # Identity
    id: UUID = field(default_factory=uuid4)

    # State
    customer_id: UUID = field(default=None)  # Reference by ID
    status: str = field(default="draft")
    created_at: datetime = field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = field(default=None)

    # Child entities (private - access through root only)
    _items: list["OrderItem"] = field(default_factory=list, repr=False)

    # Pending domain events
    _events: list["DomainEvent"] = field(default_factory=list, repr=False)

    # Constants for invariants
    MAX_ITEMS = 100
    MIN_ORDER_AMOUNT = Decimal("10.00")

    # ==================== Queries ====================

    @property
    def items(self) -> tuple["OrderItem", ...]:
        """Expose items as immutable tuple."""
        return tuple(self._items)

    @property
    def total(self) -> "Money":
        """Calculate order total - derived from items."""
        return sum(
            (item.subtotal for item in self._items),
            Money.zero("USD"),
        )

    @property
    def item_count(self) -> int:
        return len(self._items)

    def get_item(self, product_id: UUID) -> Optional["OrderItem"]:
        """Find item by product ID."""
        return next(
            (item for item in self._items if item.product_id == product_id),
            None,
        )

    # ==================== Commands ====================

    def add_item(
        self,
        product_id: UUID,
        quantity: int,
        unit_price: "Money",
    ) -> "OrderItem":
        """
        Add item to order.

        Invariants enforced:
        - Order must be in draft status
        - Cannot exceed MAX_ITEMS
        - Quantity must be positive
        - Duplicate products update quantity
        """
        # Invariant: modifiable status
        self._ensure_modifiable()

        # Invariant: max items
        if len(self._items) >= self.MAX_ITEMS:
            raise DomainError(f"Order cannot have more than {self.MAX_ITEMS} items")

        # Invariant: positive quantity
        if quantity <= 0:
            raise DomainError("Quantity must be positive")

        # Check for existing item (update vs add)
        existing = self.get_item(product_id)
        if existing:
            existing.quantity += quantity
            self._events.append(OrderItemQuantityChanged(
                order_id=self.id,
                product_id=product_id,
                new_quantity=existing.quantity,
            ))
            return existing

        # Create new item
        item = OrderItem(
            order_id=self.id,
            product_id=product_id,
            quantity=quantity,
            unit_price=unit_price,
        )
        self._items.append(item)
        self._events.append(OrderItemAdded(
            order_id=self.id,
            product_id=product_id,
            quantity=quantity,
        ))
        return item

    def remove_item(self, product_id: UUID) -> None:
        """Remove item from order."""
        self._ensure_modifiable()

        item = self.get_item(product_id)
        if not item:
            raise DomainError(f"Item {product_id} not found in order")

        self._items.remove(item)
        self._events.append(OrderItemRemoved(
            order_id=self.id,
            product_id=product_id,
        ))

    def submit(self) -> None:
        """
        Submit order for processing.

        Invariants:
        - Must be in draft status
        - Must have at least one item
        - Total must meet minimum amount
        """
        self._ensure_modifiable()

        # Invariant: non-empty
        if not self._items:
            raise DomainError("Cannot submit empty order")

        # Invariant: minimum amount
        if self.total.amount < self.MIN_ORDER_AMOUNT:
            raise DomainError(
                f"Order total must be at least {self.MIN_ORDER_AMOUNT}"
            )

        # State transition
        self.status = "submitted"
        self.submitted_at = datetime.utcnow()

        self._events.append(OrderSubmitted(
            order_id=self.id,
            customer_id=self.customer_id,
            total=self.total,
            submitted_at=self.submitted_at,
        ))

    def cancel(self, reason: str) -> None:
        """Cancel order."""
        if self.status not in ("draft", "submitted"):
            raise DomainError(f"Cannot cancel order in {self.status} status")

        self.status = "cancelled"
        self._events.append(OrderCancelled(
            order_id=self.id,
            reason=reason,
        ))

    # ==================== Internal Helpers ====================

    def _ensure_modifiable(self) -> None:
        """Guard: order must be in draft status."""
        if self.status != "draft":
            raise DomainError(f"Cannot modify order in {self.status} status")

    # ==================== Event Collection ====================

    def collect_events(self) -> list["DomainEvent"]:
        """Collect and clear pending domain events."""
        events = self._events.copy()
        self._events.clear()
        return events


@dataclass
class OrderItem:
    """
    Entity within Order aggregate.

    Not directly accessible from outside - all access through OrderAggregate.
    """
    order_id: UUID
    product_id: UUID  # Reference to Product aggregate by ID
    quantity: int
    unit_price: "Money"

    @property
    def subtotal(self) -> "Money":
        return self.unit_price * self.quantity
```

## Aggregate Sizing

### Small vs Large Aggregates

```
+-------------------------------------------------------------------+
|                    Aggregate Sizing Trade-offs                     |
+-------------------------------------------------------------------+
|                                                                   |
|   SMALL AGGREGATES               LARGE AGGREGATES                 |
|   +-------------------+          +-------------------+            |
|   | Order             |          | Order             |            |
|   | - items[]         |          | - items[]         |            |
|   +-------------------+          | - payments[]      |            |
|                                  | - shipments[]     |            |
|   +-------------------+          | - returns[]       |            |
|   | Payment           |          +-------------------+            |
|   +-------------------+                                           |
|                                                                   |
|   +-------------------+          PROBLEMS:                        |
|   | Shipment          |          - Concurrency conflicts          |
|   +-------------------+          - Performance issues             |
|                                  - Long transactions              |
|   BENEFITS:                      - Memory pressure                |
|   - Better concurrency                                            |
|   - Faster loads                 WHEN ACCEPTABLE:                 |
|   - Smaller transactions         - Few children                   |
|   - Clearer boundaries           - Always loaded together         |
|                                  - Strong invariants              |
+-------------------------------------------------------------------+
```

### Sizing Guidelines

| Factor | Small Aggregate | Large Aggregate |
|--------|-----------------|-----------------|
| Children count | < 20 | Unbounded |
| Concurrent updates | Multiple users | Single user |
| Invariants | Cross-entity | Entity-local |
| Load pattern | Often loaded | Rarely all loaded |

### Refactoring Large Aggregates

```python
# BEFORE: Large aggregate with payments inside order
class OrderAggregate:
    _items: list[OrderItem]
    _payments: list[Payment]  # PROBLEM: Grows unbounded

    def add_payment(self, amount: Money) -> Payment:
        # This causes concurrency issues
        ...

# AFTER: Separate Payment aggregate
class OrderAggregate:
    _items: list[OrderItem]
    # Payments moved to separate aggregate

class PaymentAggregate:
    """Separate aggregate for payments."""
    id: UUID
    order_id: UUID  # Reference to Order by ID
    amount: Money
    status: str

    def capture(self) -> list[DomainEvent]:
        """Process payment capture."""
        self.status = "captured"
        return [PaymentCaptured(payment_id=self.id, order_id=self.order_id)]
```

## Cross-Aggregate References

### Reference by ID Pattern

```python
class OrderAggregate:
    """Order references other aggregates by ID only."""

    customer_id: UUID  # NOT: customer: Customer
    product_ids: list[UUID]  # NOT: products: list[Product]

    def __init__(self, customer_id: UUID):
        # Validate customer exists in application service,
        # not in domain model
        self.customer_id = customer_id


# Application service handles cross-aggregate coordination
class OrderApplicationService:
    def __init__(
        self,
        order_repo: IOrderRepository,
        customer_repo: ICustomerRepository,
        inventory_service: IInventoryService,
    ):
        self._orders = order_repo
        self._customers = customer_repo
        self._inventory = inventory_service

    async def create_order(
        self,
        customer_id: UUID,
        items: list[OrderItemDTO],
    ) -> Order:
        # Validate customer exists
        customer = await self._customers.get(customer_id)
        if not customer:
            raise NotFoundError(f"Customer {customer_id} not found")

        # Validate inventory
        for item in items:
            available = await self._inventory.check_availability(
                item.product_id,
                item.quantity,
            )
            if not available:
                raise DomainError(f"Insufficient inventory for {item.product_id}")

        # Create order aggregate
        order = OrderAggregate(customer_id=customer_id)
        for item in items:
            order.add_item(item.product_id, item.quantity, item.unit_price)

        # Persist
        await self._orders.save(order)

        return order
```

### Eventual Consistency Between Aggregates

```python
# Domain events enable eventual consistency
class OrderSubmitted(DomainEvent):
    order_id: UUID
    customer_id: UUID
    items: list[dict]  # product_id, quantity

# Event handler in Inventory context
class ReserveInventoryHandler:
    async def handle(self, event: OrderSubmitted) -> None:
        """Reserve inventory when order is submitted."""
        for item in event.items:
            await self._inventory.reserve(
                product_id=item["product_id"],
                quantity=item["quantity"],
                order_id=event.order_id,
            )

# Event handler in Notification context
class SendOrderConfirmationHandler:
    async def handle(self, event: OrderSubmitted) -> None:
        """Send confirmation email when order is submitted."""
        customer = await self._customers.get(event.customer_id)
        await self._email.send_order_confirmation(
            email=customer.email,
            order_id=event.order_id,
        )
```

## Invariant Enforcement Patterns

### Factory Pattern for Complex Creation

```python
class OrderFactory:
    """Factory for complex aggregate creation with invariants."""

    def __init__(
        self,
        pricing_service: PricingService,
        inventory_checker: IInventoryChecker,
    ):
        self._pricing = pricing_service
        self._inventory = inventory_checker

    async def create_from_cart(
        self,
        customer_id: UUID,
        cart: ShoppingCart,
    ) -> OrderAggregate:
        """
        Create order from cart with full validation.

        Factory ensures aggregate is created in valid state.
        """
        # Validate all items available
        for item in cart.items:
            if not await self._inventory.is_available(item.product_id, item.quantity):
                raise DomainError(f"Product {item.product_id} not available")

        # Create order
        order = OrderAggregate(customer_id=customer_id)

        # Add items with current pricing
        for item in cart.items:
            price = await self._pricing.get_price(item.product_id)
            order.add_item(item.product_id, item.quantity, price)

        return order
```

### Specification Pattern for Complex Rules

```python
from abc import ABC, abstractmethod

class Specification(ABC):
    """Specification pattern for complex business rules."""

    @abstractmethod
    def is_satisfied_by(self, candidate: Any) -> bool:
        pass

    def __and__(self, other: "Specification") -> "AndSpecification":
        return AndSpecification(self, other)

    def __or__(self, other: "Specification") -> "OrSpecification":
        return OrSpecification(self, other)

    def __invert__(self) -> "NotSpecification":
        return NotSpecification(self)


class OrderCanBeShipped(Specification):
    """Order is ready for shipping."""

    def is_satisfied_by(self, order: OrderAggregate) -> bool:
        return (
            order.status == "paid"
            and order.item_count > 0
            and not order.has_backorder_items
        )


class OrderRequiresApproval(Specification):
    """Order requires manual approval."""

    def __init__(self, threshold: Money):
        self.threshold = threshold

    def is_satisfied_by(self, order: OrderAggregate) -> bool:
        return order.total > self.threshold


# Usage
can_ship = OrderCanBeShipped()
needs_approval = OrderRequiresApproval(Money(1000, "USD"))

# Combine specifications
auto_ship_eligible = can_ship & ~needs_approval

if auto_ship_eligible.is_satisfied_by(order):
    order.ship()
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Aggregate size | Prefer small, split when > 20 children |
| Cross-aggregate refs | Always by ID, never by object |
| Invariant scope | Within aggregate only |
| Concurrency | One aggregate per transaction |
| Event publishing | Collect in aggregate, publish after persist |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER reference other aggregates by object
class Order:
    customer: Customer  # WRONG - should be customer_id: UUID

# NEVER modify multiple aggregates in one transaction
async def bad_submit_order(order: Order, inventory: Inventory):
    order.submit()
    inventory.reserve(order.items)  # WRONG - two aggregates!
    await db.commit()  # Single transaction for both

# NEVER expose internal collections
class Order:
    @property
    def items(self) -> list[OrderItem]:
        return self._items  # WRONG - exposes mutable list

# NEVER have child entities hold back-references
class OrderItem:
    order: Order  # WRONG - creates circular reference

# NEVER validate across aggregates in domain
class Order:
    def submit(self, customer: Customer):  # WRONG - customer is separate aggregate
        if customer.is_blocked:
            raise Error()

# NEVER have unbounded collections
class Customer:
    orders: list[Order]  # WRONG - grows unbounded, use reference by ID
```

## Related Skills

- `domain-driven-design` - DDD building blocks
- `event-sourcing` - Event-sourced aggregates
- `distributed-locks` - Locking for cross-aggregate ops
- `clean-architecture` - Layered architecture patterns

## Capability Details

### aggregate-root
**Keywords:** aggregate root, root entity, consistency boundary, transactional
**Solves:**
- How do I design an aggregate root?
- Control access to child entities
- Enforce transactional boundaries

### invariants
**Keywords:** invariant, business rule, validation, specification
**Solves:**
- How do I enforce business invariants?
- Use specification pattern for complex rules
- Validate aggregate state

### aggregate-sizing
**Keywords:** aggregate size, small aggregate, performance, concurrency
**Solves:**
- How large should my aggregates be?
- When to split aggregates
- Balance consistency vs performance

### cross-aggregate
**Keywords:** reference by ID, eventual consistency, domain events
**Solves:**
- How do I reference other aggregates?
- Coordinate changes across aggregates
- Implement eventual consistency

### factory-pattern
**Keywords:** factory, complex creation, aggregate factory
**Solves:**
- How do I create complex aggregates?
- Validate creation invariants
- Encapsulate creation logic
