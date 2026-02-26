# Entities and Value Objects

## Entity vs Value Object Decision

| Characteristic | Entity | Value Object |
|----------------|--------|--------------|
| Identity | Has unique ID | No ID, defined by attributes |
| Equality | By ID | By all attributes |
| Mutability | Mutable (state changes) | Immutable (replace whole) |
| Lifecycle | Tracked over time | Created/discarded |
| Example | User, Order, Product | Email, Money, Address |

## Entity Implementation (Python 2026)

```python
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Self
from uuid import UUID

from uuid_utils import uuid7  # pip install uuid-utils (UUIDv7 support)

from app.domain.events import DomainEvent


@dataclass
class Entity:
    """Base entity with identity and domain events.

    Uses UUIDv7 for time-ordered, index-friendly IDs.
    PostgreSQL 18: Use gen_random_uuid_v7() for DB-generated IDs.
    """

    id: UUID = field(default_factory=uuid7)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    _domain_events: list[DomainEvent] = field(default_factory=list, repr=False)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Entity):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)

    def add_event(self, event: DomainEvent) -> None:
        """Add domain event for later publishing."""
        self._domain_events.append(event)

    def collect_events(self) -> list[DomainEvent]:
        """Collect and clear domain events."""
        events = self._domain_events.copy()
        self._domain_events.clear()
        return events


@dataclass
class User(Entity):
    """User entity with business logic."""

    email: str = ""
    name: str = ""
    status: str = "pending"

    def activate(self) -> Self:
        """Activate user account."""
        if self.status == "active":
            raise ValueError("User already active")

        self.status = "active"
        self.updated_at = datetime.now(timezone.utc)
        self.add_event(UserActivated(user_id=self.id))
        return self

    def change_email(self, new_email: str) -> Self:
        """Change user email with validation."""
        if not Email.is_valid(new_email):
            raise ValueError("Invalid email format")

        old_email = self.email
        self.email = new_email
        self.updated_at = datetime.now(timezone.utc)
        self.add_event(UserEmailChanged(
            user_id=self.id,
            old_email=old_email,
            new_email=new_email,
        ))
        return self
```

## Value Object Implementation

```python
from dataclasses import dataclass
from decimal import Decimal
from typing import Self
import re


@dataclass(frozen=True)  # Immutable!
class Email:
    """Email value object with validation."""

    value: str

    def __post_init__(self):
        if not self.is_valid(self.value):
            raise ValueError(f"Invalid email: {self.value}")

    @staticmethod
    def is_valid(email: str) -> bool:
        pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
        return bool(re.match(pattern, email))

    def __str__(self) -> str:
        return self.value


@dataclass(frozen=True)
class Money:
    """Money value object with currency."""

    amount: Decimal
    currency: str = "USD"

    def __post_init__(self):
        # Validate via object.__setattr__ for frozen dataclass
        if self.amount < 0:
            raise ValueError("Amount cannot be negative")
        if len(self.currency) != 3:
            raise ValueError("Currency must be 3-letter code")

    def add(self, other: Self) -> Self:
        """Add money (same currency only)."""
        if self.currency != other.currency:
            raise ValueError("Cannot add different currencies")
        return Money(self.amount + other.amount, self.currency)

    def multiply(self, factor: int | Decimal) -> Self:
        """Multiply by factor."""
        return Money(self.amount * Decimal(factor), self.currency)

    def __str__(self) -> str:
        return f"{self.currency} {self.amount:.2f}"


@dataclass(frozen=True)
class Address:
    """Address value object."""

    street: str
    city: str
    country: str
    postal_code: str

    def __post_init__(self):
        if not all([self.street, self.city, self.country, self.postal_code]):
            raise ValueError("All address fields required")

    def format_single_line(self) -> str:
        return f"{self.street}, {self.city}, {self.postal_code}, {self.country}"
```

## Using Value Objects in Entities

```python
@dataclass
class Order(Entity):
    """Order entity using value objects."""

    customer_email: Email = field(default_factory=lambda: Email("default@example.com"))
    shipping_address: Address | None = None
    total: Money = field(default_factory=lambda: Money(Decimal("0")))
    items: list["OrderItem"] = field(default_factory=list)

    def add_item(self, product_id: UUID, price: Money, quantity: int) -> Self:
        """Add item and recalculate total."""
        item = OrderItem(
            product_id=product_id,
            price=price,
            quantity=quantity,
        )
        self.items.append(item)
        self.total = self._calculate_total()
        return self

    def _calculate_total(self) -> Money:
        """Calculate order total from items."""
        total = Money(Decimal("0"))
        for item in self.items:
            total = total.add(item.price.multiply(item.quantity))
        return total
```

## Anti-Patterns

```python
# WRONG: Value object with ID
@dataclass
class Money:
    id: UUID  # NO! Value objects have no identity
    amount: Decimal

# WRONG: Mutable value object
@dataclass  # Missing frozen=True!
class Email:
    value: str

# WRONG: Entity equality by attributes
@dataclass
class User:
    def __eq__(self, other):
        return self.email == other.email  # NO! Use ID

# WRONG: Business logic outside entity
def activate_user(user: User) -> None:
    user.status = "active"  # NO! Put in User.activate()

# WRONG: Using UUIDv4 in 2026
from uuid import uuid4
id: UUID = field(default_factory=uuid4)  # NO! Use uuid7 for time-ordering
```

## PostgreSQL 18 UUIDv7 Integration

```sql
-- PostgreSQL 18 native UUIDv7 generation
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid_v7(),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- UUIDv7 benefits for indexing
-- 1. Time-ordered: sequential inserts, less index fragmentation
-- 2. Sortable: ORDER BY id ≈ ORDER BY created_at
-- 3. Better cache locality: recent records clustered together
```
