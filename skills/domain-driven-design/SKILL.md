---
name: domain-driven-design
description: Domain-Driven Design tactical patterns for complex business domains. Use when modeling entities, value objects, domain services, repositories, or establishing bounded contexts.
context: fork
agent: backend-system-architect
version: 1.0.0
tags: [ddd, domain-modeling, entities, value-objects, bounded-contexts, python, 2026]
author: SkillForge
user-invocable: false
---

# Domain-Driven Design Tactical Patterns

Model complex business domains with entities, value objects, and bounded contexts.

## When to Use

- Modeling complex business logic
- Separating domain from infrastructure
- Establishing clear boundaries between subdomains
- Building rich domain models with behavior
- Implementing ubiquitous language in code

## Building Blocks Overview

```
+-------------------------------------------------------------------+
|                     DDD Building Blocks                            |
+-------------------------------------------------------------------+
|                                                                   |
|   ENTITIES              VALUE OBJECTS          AGGREGATES         |
|   +----------+          +----------+           +----------+       |
|   |  Order   |          |  Money   |           | [Order]  |       |
|   | (has ID) |          | (no ID)  |           |  /    \  |       |
|   +----------+          +----------+           | Item  Item|       |
|                                                +----------+       |
|                                                                   |
|   DOMAIN SERVICES       REPOSITORIES           DOMAIN EVENTS      |
|   +----------+          +----------+           +----------+       |
|   | Pricing  |          | IOrder   |           | OrderPlaced|     |
|   | Service  |          | Repo     |           +----------+       |
|   +----------+          +----------+                              |
|                                                                   |
|   FACTORIES             SPECIFICATIONS         MODULES            |
|   +----------+          +----------+           +----------+       |
|   | Order    |          | Overdue  |           | orders/  |       |
|   | Factory  |          | Order    |           | payments/|       |
|   +----------+          +----------+           +----------+       |
|                                                                   |
+-------------------------------------------------------------------+
```

## Entities

### Entity Definition

```python
from dataclasses import dataclass, field
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional

@dataclass
class Order:
    """
    Entity: Has identity, mutable state, and lifecycle.

    Two orders are equal if they have the same ID,
    regardless of other attributes.
    """
    id: UUID = field(default_factory=uuid4)
    customer_id: UUID = field(default=None)
    status: str = field(default="draft")
    created_at: datetime = field(default_factory=datetime.utcnow)
    _items: list["OrderItem"] = field(default_factory=list, repr=False)

    def __eq__(self, other: object) -> bool:
        """Identity equality: same ID = same entity."""
        if not isinstance(other, Order):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)

    # Domain behavior (not just data)
    def add_item(self, product_id: UUID, quantity: int, price: "Money") -> None:
        """Add item with business rule validation."""
        if self.status != "draft":
            raise DomainError("Cannot modify submitted order")
        if quantity <= 0:
            raise DomainError("Quantity must be positive")

        item = OrderItem(
            order_id=self.id,
            product_id=product_id,
            quantity=quantity,
            unit_price=price,
        )
        self._items.append(item)

    def submit(self) -> list["DomainEvent"]:
        """Submit order with state transition and event emission."""
        if not self._items:
            raise DomainError("Cannot submit empty order")
        if self.status != "draft":
            raise DomainError(f"Cannot submit order in {self.status} status")

        self.status = "submitted"
        return [OrderSubmitted(order_id=self.id, submitted_at=datetime.utcnow())]

    @property
    def total(self) -> "Money":
        """Calculate total from items."""
        return sum((item.subtotal for item in self._items), Money.zero("USD"))
```

### Entity vs Value Object Decision

| Criterion | Entity | Value Object |
|-----------|--------|--------------|
| Has unique identity? | Yes | No |
| Tracked over time? | Yes | No |
| Can be substituted? | No (same ID) | Yes (same values) |
| Mutable? | Yes (lifecycle) | No (immutable) |
| Examples | Order, User, Product | Money, Address, DateRange |

## Value Objects

### Value Object Definition

```python
from dataclasses import dataclass
from typing import Self
from decimal import Decimal

@dataclass(frozen=True)  # Immutable!
class Money:
    """
    Value Object: Defined by attributes, not identity.

    Two Money instances with same amount and currency are equal.
    """
    amount: Decimal
    currency: str

    def __post_init__(self):
        """Validate on creation - invalid states are impossible."""
        if self.amount < 0:
            raise ValueError("Amount cannot be negative")
        if len(self.currency) != 3:
            raise ValueError("Currency must be 3-letter code")

    def __add__(self, other: Self) -> Self:
        """Value objects return new instances, never mutate."""
        if not isinstance(other, Money):
            return NotImplemented
        if self.currency != other.currency:
            raise ValueError("Cannot add different currencies")
        return Money(self.amount + other.amount, self.currency)

    def __mul__(self, multiplier: int | Decimal) -> Self:
        return Money(self.amount * Decimal(multiplier), self.currency)

    @classmethod
    def zero(cls, currency: str) -> Self:
        return cls(Decimal("0"), currency)

    @classmethod
    def from_cents(cls, cents: int, currency: str) -> Self:
        return cls(Decimal(cents) / 100, currency)


@dataclass(frozen=True)
class Address:
    """Value object for postal addresses."""
    street: str
    city: str
    postal_code: str
    country: str

    def __post_init__(self):
        if not self.street or not self.city:
            raise ValueError("Street and city required")

    def format_for_shipping(self) -> str:
        """Behavior on value objects is fine."""
        return f"{self.street}\n{self.city}, {self.postal_code}\n{self.country}"


@dataclass(frozen=True)
class DateRange:
    """Value object for date ranges with invariants."""
    start: datetime
    end: datetime

    def __post_init__(self):
        if self.end <= self.start:
            raise ValueError("End must be after start")

    def overlaps(self, other: "DateRange") -> bool:
        return self.start < other.end and other.start < self.end

    def contains(self, date: datetime) -> bool:
        return self.start <= date < self.end

    @property
    def duration_days(self) -> int:
        return (self.end - self.start).days
```

## Domain Services

### When to Use Domain Services

```python
from typing import Protocol

class PricingService:
    """
    Domain Service: Business logic that doesn't belong to a single entity.

    Use when:
    - Logic spans multiple aggregates
    - Logic requires external data (exchange rates, etc.)
    - Logic is a domain concept (pricing, shipping calculation)
    """

    def __init__(
        self,
        product_repo: "IProductRepository",
        discount_repo: "IDiscountRepository",
    ):
        self._products = product_repo
        self._discounts = discount_repo

    async def calculate_order_total(
        self,
        order: Order,
        customer: Customer,
    ) -> Money:
        """Calculate total with discounts - involves multiple entities."""
        subtotal = order.total

        # Apply customer-level discounts
        discount = await self._discounts.get_for_customer(customer.id)
        if discount:
            subtotal = discount.apply(subtotal)

        # Apply product-level discounts
        for item in order.items:
            product = await self._products.get(item.product_id)
            if product.has_discount:
                # Recalculate item price
                item_discount = product.discount.apply(item.subtotal)
                subtotal = subtotal - (item.subtotal - item_discount)

        return subtotal


class TransferService:
    """Domain service for money transfers between accounts."""

    async def transfer(
        self,
        from_account: Account,
        to_account: Account,
        amount: Money,
    ) -> list[DomainEvent]:
        """
        Transfer spans two aggregates - must be a domain service.

        Note: This is a domain service, not an application service.
        It contains domain logic, not orchestration.
        """
        if from_account.currency != to_account.currency:
            raise DomainError("Cross-currency transfers not supported")

        # Domain logic: both operations must succeed
        from_account.withdraw(amount)
        to_account.deposit(amount)

        return [
            TransferCompleted(
                from_account_id=from_account.id,
                to_account_id=to_account.id,
                amount=amount,
            )
        ]
```

## Repositories

### Repository Pattern

```python
from typing import Protocol, Optional
from uuid import UUID

class IOrderRepository(Protocol):
    """
    Repository: Collection-like interface for aggregates.

    Repositories:
    - Abstract persistence mechanism
    - Return domain objects (not ORM models)
    - One per aggregate root
    """

    async def get(self, order_id: UUID) -> Optional[Order]:
        """Get order by ID."""
        ...

    async def save(self, order: Order) -> None:
        """Persist order (insert or update)."""
        ...

    async def delete(self, order_id: UUID) -> None:
        """Remove order."""
        ...

    async def find_by_customer(
        self,
        customer_id: UUID,
        status: Optional[str] = None,
    ) -> list[Order]:
        """Query orders by customer."""
        ...


class PostgresOrderRepository:
    """Concrete implementation using SQLAlchemy."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get(self, order_id: UUID) -> Optional[Order]:
        result = await self._session.execute(
            select(OrderModel)
            .where(OrderModel.id == order_id)
            .options(selectinload(OrderModel.items))
        )
        model = result.scalar_one_or_none()
        return self._to_domain(model) if model else None

    async def save(self, order: Order) -> None:
        model = self._to_model(order)
        await self._session.merge(model)

    def _to_domain(self, model: OrderModel) -> Order:
        """Map ORM model to domain entity."""
        order = Order(
            id=model.id,
            customer_id=model.customer_id,
            status=model.status,
            created_at=model.created_at,
        )
        order._items = [
            OrderItem(
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=Money(item.price_amount, item.price_currency),
            )
            for item in model.items
        ]
        return order

    def _to_model(self, order: Order) -> OrderModel:
        """Map domain entity to ORM model."""
        return OrderModel(
            id=order.id,
            customer_id=order.customer_id,
            status=order.status,
            created_at=order.created_at,
            items=[
                OrderItemModel(
                    product_id=item.product_id,
                    quantity=item.quantity,
                    price_amount=item.unit_price.amount,
                    price_currency=item.unit_price.currency,
                )
                for item in order._items
            ],
        )
```

## Domain Events

### Event Definition and Publishing

```python
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4
from typing import Protocol

@dataclass(frozen=True)
class DomainEvent:
    """Base class for domain events."""
    event_id: UUID = field(default_factory=uuid4)
    occurred_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(frozen=True)
class OrderSubmitted(DomainEvent):
    """Emitted when an order is submitted."""
    order_id: UUID = field(default=None)
    customer_id: UUID = field(default=None)
    total_amount: Decimal = field(default=None)


@dataclass(frozen=True)
class PaymentReceived(DomainEvent):
    """Emitted when payment is received."""
    order_id: UUID = field(default=None)
    payment_id: UUID = field(default=None)
    amount: Decimal = field(default=None)


class IDomainEventPublisher(Protocol):
    """Port for publishing domain events."""
    async def publish(self, events: list[DomainEvent]) -> None: ...


# Collecting events from aggregates
class Order:
    def __init__(self):
        self._events: list[DomainEvent] = []

    def submit(self) -> None:
        self.status = "submitted"
        self._events.append(OrderSubmitted(order_id=self.id))

    def collect_events(self) -> list[DomainEvent]:
        """Collect and clear pending events."""
        events = self._events.copy()
        self._events.clear()
        return events
```

## Bounded Contexts

### Context Mapping

```
+-------------------------------------------------------------------+
|                     Bounded Contexts                               |
+-------------------------------------------------------------------+
|                                                                   |
|   +-------------------+        +-------------------+              |
|   |   ORDERS          |        |   PAYMENTS        |              |
|   |   Context         |        |   Context         |              |
|   +-------------------+        +-------------------+              |
|   |                   |        |                   |              |
|   | Order (Aggregate) |        | Payment (Entity)  |              |
|   | OrderItem (Entity)|  <-->  | PaymentMethod     |              |
|   | Money (VO)        |  ACL   | Transaction       |              |
|   |                   |        |                   |              |
|   | OrderService      |        | PaymentService    |              |
|   | IOrderRepository  |        | IPaymentGateway   |              |
|   +-------------------+        +-------------------+              |
|                                                                   |
|   +-------------------+        +-------------------+              |
|   |   INVENTORY       |        |   SHIPPING        |              |
|   |   Context         |        |   Context         |              |
|   +-------------------+        +-------------------+              |
|   |                   |        |                   |              |
|   | Product           |  <-->  | Shipment          |              |
|   | Stock             |  PUB/  | Address (VO)      |              |
|   | Warehouse         |  SUB   | Carrier           |              |
|   |                   |        |                   |              |
|   +-------------------+        +-------------------+              |
|                                                                   |
|   Context Relationships:                                          |
|   ACL = Anti-Corruption Layer (translate between models)          |
|   PUB/SUB = Events (loose coupling)                               |
|   Shared Kernel = Shared code (tight coupling, use sparingly)     |
|                                                                   |
+-------------------------------------------------------------------+
```

### Anti-Corruption Layer

```python
# orders/infrastructure/payment_adapter.py
from orders.domain.ports import IPaymentService
from orders.domain.value_objects import Money, PaymentResult

class PaymentServiceAdapter(IPaymentService):
    """
    Anti-Corruption Layer: Translates between contexts.

    Protects Orders context from Payment context details.
    """

    def __init__(self, payment_client: PaymentContextClient):
        self._client = payment_client

    async def process_payment(
        self,
        order_id: UUID,
        amount: Money,
    ) -> PaymentResult:
        """Translate our Money to Payment context's format."""
        # Payment context uses different models
        payment_request = {
            "reference": str(order_id),
            "amount_cents": int(amount.amount * 100),
            "currency_code": amount.currency,
        }

        response = await self._client.create_payment(payment_request)

        # Translate response back to our domain
        return PaymentResult(
            success=response["status"] == "completed",
            payment_id=UUID(response["id"]),
            error=response.get("error_message"),
        )
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Entity equality | By ID, not attributes |
| Value object mutability | Always immutable (frozen=True) |
| Repository scope | One per aggregate root |
| Domain events | Collect in entity, publish after persist |
| Context boundaries | By business capability, not technical |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER have anemic domain models (data-only classes)
@dataclass
class Order:
    id: UUID
    items: list
    status: str
    # WRONG - no behavior! This is just a DTO

# NEVER leak infrastructure into domain
class Order:
    def save(self, session: Session):  # WRONG - knows about DB!
        session.add(self)

# NEVER use mutable value objects
@dataclass
class Money:  # WRONG - missing frozen=True
    amount: Decimal
    def add(self, other):
        self.amount += other.amount  # WRONG - mutates!

# NEVER have repositories return ORM models
async def get(self, id: UUID) -> OrderModel:  # WRONG - returns ORM
    return await self._session.get(OrderModel, id)

# NEVER put orchestration logic in domain services
class OrderService:
    async def create_order(self, data, session, message_queue):
        order = Order(...)
        session.add(order)  # WRONG - this is application service work
        await message_queue.publish(...)  # WRONG - orchestration
```

## Related Skills

- `aggregate-patterns` - Deep dive on aggregate design
- `event-sourcing` - Event-sourced aggregates
- `clean-architecture` - Layered architecture with DDD
- `database-schema-designer` - Schema design for DDD

## Capability Details

### entities
**Keywords:** entity, identity, lifecycle, mutable, domain object
**Solves:**
- How do I model entities in Python?
- Entity equality by ID
- Adding behavior to entities

### value-objects
**Keywords:** value object, immutable, frozen, dataclass, structural equality
**Solves:**
- How do I create immutable value objects?
- When to use value objects vs entities
- Value object validation

### domain-services
**Keywords:** domain service, business logic, cross-aggregate, stateless
**Solves:**
- When to use a domain service?
- Logic spanning multiple aggregates
- Domain vs application services

### repositories
**Keywords:** repository, persistence, collection, IRepository, protocol
**Solves:**
- How do I implement the repository pattern?
- Abstract database access
- Map ORM to domain models

### bounded-contexts
**Keywords:** bounded context, context map, ACL, subdomain, ubiquitous language
**Solves:**
- How do I define bounded contexts?
- Integrate between contexts with ACL
- Context relationships (shared kernel, pub/sub)
