---
title: Event Sourcing & CQRS
impact: HIGH
impactDescription: "Storing only current state loses the complete audit trail — event sourcing preserves every state change and enables temporal queries"
tags: event-sourcing, cqrs, event-store, projections, aggregate
---

## Event Sourcing & CQRS

Store state as immutable events and separate read/write models for scalable, auditable systems.

**Incorrect — mutable state without event history:**
```python
# WRONG: Direct mutation loses history
class Account:
    def __init__(self, balance: float = 0):
        self.balance = balance

    def deposit(self, amount: float):
        self.balance += amount  # No record of what happened!

    def withdraw(self, amount: float):
        self.balance -= amount  # Can't audit, can't replay
```

**Correct — event-sourced aggregate with CQRS:**
```python
from dataclasses import dataclass, field
from typing import Any

@dataclass
class DomainEvent:
    aggregate_id: str
    version: int
    data: dict[str, Any]

class Account:
    def __init__(self):
        self._changes: list[DomainEvent] = []
        self._version = 0
        self.balance = 0.0

    def deposit(self, amount: float):
        if amount <= 0:
            raise ValueError("Amount must be positive")
        self._raise_event("MoneyDeposited", {"amount": amount})

    def withdraw(self, amount: float):
        if amount > self.balance:
            raise ValueError("Insufficient funds")
        self._raise_event("MoneyWithdrawn", {"amount": amount})

    def _raise_event(self, event_type: str, data: dict):
        event = DomainEvent(
            aggregate_id=self.id,
            version=self._version + 1,
            data={"type": event_type, **data},
        )
        self._apply(event)
        self._changes.append(event)

    def _apply(self, event: DomainEvent):
        match event.data["type"]:
            case "MoneyDeposited":
                self.balance += event.data["amount"]
            case "MoneyWithdrawn":
                self.balance -= event.data["amount"]
        self._version = event.version

# Event store with optimistic concurrency
class EventStore:
    async def save(self, aggregate_id: str, events: list[DomainEvent], expected_version: int):
        async with self.db.transaction():
            current = await self.db.fetchval(
                "SELECT MAX(version) FROM events WHERE aggregate_id = $1",
                aggregate_id,
            )
            if current != expected_version:
                raise ConcurrencyError(f"Expected {expected_version}, got {current}")
            for event in events:
                await self.db.execute(
                    "INSERT INTO events (aggregate_id, version, data) VALUES ($1, $2, $3)",
                    aggregate_id, event.version, event.data,
                )

# CQRS: Separate read model projection
class BalanceProjection:
    async def handle(self, event: DomainEvent):
        match event.data["type"]:
            case "MoneyDeposited":
                await self.db.execute(
                    "UPDATE account_balances SET balance = balance + $1 WHERE id = $2",
                    event.data["amount"], event.aggregate_id,
                )
            case "MoneyWithdrawn":
                await self.db.execute(
                    "UPDATE account_balances SET balance = balance - $1 WHERE id = $2",
                    event.data["amount"], event.aggregate_id,
                )
```

**Key rules:**
- Events are immutable and named in past tense (`OrderPlaced`, not `PlaceOrder`)
- Use optimistic concurrency with version checks to prevent conflicts
- CQRS read models are eventually consistent — design UX accordingly
- Snapshot every N events (e.g., 100) to avoid replaying long event streams
- Never delete events — use compensating events instead
