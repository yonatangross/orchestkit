# Invariant Enforcement

## What Are Invariants?

Business rules that must **always** be true for the aggregate to be valid.

```python
# Example invariants:
# - Order total must equal sum of item prices
# - Account balance cannot go negative
# - Booking cannot overlap with existing bookings
# - Team must have at least one member
```

## Enforcement Patterns

### 1. Constructor Validation

```python
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

from uuid_utils import uuid7


@dataclass
class BankAccount:
    """Bank account with balance invariant."""

    id: UUID = field(default_factory=uuid7)
    owner_id: UUID = field(default_factory=uuid7)
    balance: Decimal = Decimal("0")
    currency: str = "USD"

    def __post_init__(self) -> None:
        """Validate invariants on construction."""
        self._validate_balance()
        self._validate_currency()

    def _validate_balance(self) -> None:
        if self.balance < 0:
            raise ValueError("Balance cannot be negative")

    def _validate_currency(self) -> None:
        if len(self.currency) != 3:
            raise ValueError("Currency must be 3-letter code")
```

### 2. Method-Level Enforcement

```python
@dataclass
class BankAccount:
    balance: Decimal = Decimal("0")

    def withdraw(self, amount: Decimal) -> None:
        """Withdraw with balance invariant check."""
        if amount <= 0:
            raise ValueError("Amount must be positive")

        new_balance = self.balance - amount

        # Invariant: balance >= 0
        if new_balance < 0:
            raise InsufficientFundsError(
                f"Cannot withdraw {amount}, balance is {self.balance}"
            )

        self.balance = new_balance

    def deposit(self, amount: Decimal) -> None:
        """Deposit always maintains invariant."""
        if amount <= 0:
            raise ValueError("Amount must be positive")
        self.balance += amount
```

### 3. Cross-Entity Invariants

```python
@dataclass
class Order:
    """Order with total consistency invariant."""

    items: list["OrderItem"] = field(default_factory=list)
    _total: Decimal = field(default=Decimal("0"), repr=False)

    @property
    def total(self) -> Decimal:
        return self._total

    def add_item(self, item: "OrderItem") -> None:
        """Add item and maintain total invariant."""
        self.items.append(item)
        self._recalculate_total()

    def remove_item(self, item_id: UUID) -> None:
        """Remove item and maintain total invariant."""
        self.items = [i for i in self.items if i.id != item_id]
        self._recalculate_total()

    def update_item_quantity(self, item_id: UUID, quantity: int) -> None:
        """Update quantity and maintain total invariant."""
        for item in self.items:
            if item.id == item_id:
                item.quantity = quantity
                break
        self._recalculate_total()

    def _recalculate_total(self) -> None:
        """Internal: recalculate total from items."""
        self._total = sum(
            (item.unit_price * item.quantity for item in self.items),
            Decimal("0"),
        )

    def _validate_total_invariant(self) -> None:
        """Verify total matches sum of items."""
        expected = sum(
            (item.unit_price * item.quantity for item in self.items),
            Decimal("0"),
        )
        if self._total != expected:
            raise InvariantViolationError(
                f"Total {self._total} doesn't match items sum {expected}"
            )
```

### 4. Booking/Scheduling Invariants

```python
from datetime import date


@dataclass
class Room:
    """Room with no-overlap booking invariant."""

    id: UUID = field(default_factory=uuid7)
    bookings: list["Booking"] = field(default_factory=list)

    def book(self, guest_id: UUID, check_in: date, check_out: date) -> "Booking":
        """Book room with overlap check."""
        # Invariant: no overlapping bookings
        for existing in self.bookings:
            if self._dates_overlap(
                check_in, check_out,
                existing.check_in, existing.check_out,
            ):
                raise BookingOverlapError(
                    f"Room already booked from {existing.check_in} to {existing.check_out}"
                )

        booking = Booking(
            room_id=self.id,
            guest_id=guest_id,
            check_in=check_in,
            check_out=check_out,
        )
        self.bookings.append(booking)
        return booking

    @staticmethod
    def _dates_overlap(
        start1: date, end1: date,
        start2: date, end2: date,
    ) -> bool:
        """Check if two date ranges overlap."""
        return start1 < end2 and start2 < end1


@dataclass
class Booking:
    room_id: UUID = field(default_factory=uuid7)
    guest_id: UUID = field(default_factory=uuid7)
    check_in: date = field(default_factory=date.today)
    check_out: date = field(default_factory=date.today)
```

### 5. Membership Invariants

```python
@dataclass
class Team:
    """Team with minimum membership invariant."""

    id: UUID = field(default_factory=uuid7)
    name: str = ""
    members: list["TeamMember"] = field(default_factory=list)
    owner_id: UUID = field(default_factory=uuid7)

    def __post_init__(self) -> None:
        # Owner must be a member
        if self.owner_id and not any(m.user_id == self.owner_id for m in self.members):
            self.members.append(TeamMember(user_id=self.owner_id, role="owner"))

    def add_member(self, user_id: UUID, role: str = "member") -> None:
        """Add member to team."""
        if any(m.user_id == user_id for m in self.members):
            raise ValueError("User already a member")
        self.members.append(TeamMember(user_id=user_id, role=role))

    def remove_member(self, user_id: UUID) -> None:
        """Remove member with minimum count check."""
        # Invariant: team must have at least 1 member (owner)
        if len(self.members) <= 1:
            raise ValueError("Team must have at least one member")

        # Invariant: owner cannot be removed
        if user_id == self.owner_id:
            raise ValueError("Cannot remove team owner")

        self.members = [m for m in self.members if m.user_id != user_id]
```

## Custom Exceptions

```python
class InvariantViolationError(Exception):
    """Base exception for invariant violations."""
    pass


class InsufficientFundsError(InvariantViolationError):
    """Raised when balance would go negative."""
    pass


class BookingOverlapError(InvariantViolationError):
    """Raised when bookings would overlap."""
    pass
```
