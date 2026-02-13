# Event Sourcing Examples

## Domain Event Classes

### Base Event

```python
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import ClassVar

class DomainEvent(BaseModel):
    event_id: UUID = Field(default_factory=uuid4)
    aggregate_id: UUID
    aggregate_type: ClassVar[str]
    event_type: ClassVar[str]
    version: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    schema_version: int = 1

    class Config:
        frozen = True  # Immutable
```

### Concrete Events

```python
class AccountCreated(DomainEvent):
    aggregate_type: ClassVar[str] = "Account"
    event_type: ClassVar[str] = "AccountCreated"
    owner_name: str
    initial_balance: float = 0.0

class MoneyDeposited(DomainEvent):
    aggregate_type: ClassVar[str] = "Account"
    event_type: ClassVar[str] = "MoneyDeposited"
    amount: float

class MoneyWithdrawn(DomainEvent):
    aggregate_type: ClassVar[str] = "Account"
    event_type: ClassVar[str] = "MoneyWithdrawn"
    amount: float
```

## Aggregate Implementation

```python
from abc import ABC, abstractmethod
from collections.abc import Iterable

class Aggregate(ABC):
    def __init__(self, aggregate_id: UUID | None = None):
        self._id = aggregate_id or uuid4()
        self._version = 0
        self._changes: list[DomainEvent] = []

    @property
    def id(self) -> UUID:
        return self._id

    @property
    def version(self) -> int:
        return self._version

    def load_from_history(self, events: Iterable[DomainEvent]) -> None:
        for event in events:
            self._apply(event)
            self._version = event.version

    def _raise_event(self, event: DomainEvent) -> None:
        self._apply(event)
        self._changes.append(event)

    @abstractmethod
    def _apply(self, event: DomainEvent) -> None:
        pass


class Account(Aggregate):
    def __init__(self, aggregate_id: UUID | None = None):
        super().__init__(aggregate_id)
        self.balance: float = 0.0

    def deposit(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("Amount must be positive")
        self._raise_event(MoneyDeposited(
            aggregate_id=self.id,
            version=self._version + len(self._changes) + 1,
            amount=amount
        ))

    def withdraw(self, amount: float) -> None:
        if amount > self.balance:
            raise ValueError("Insufficient funds")
        self._raise_event(MoneyWithdrawn(
            aggregate_id=self.id,
            version=self._version + len(self._changes) + 1,
            amount=amount
        ))

    def _apply(self, event: DomainEvent) -> None:
        match event:
            case AccountCreated():
                self.balance = event.initial_balance
            case MoneyDeposited():
                self.balance += event.amount
            case MoneyWithdrawn():
                self.balance -= event.amount
```

## Event Handler Patterns

### Projection Handler

```python
class AccountBalanceProjection:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def handle(self, event: DomainEvent) -> None:
        handler = getattr(self, f"_on_{event.event_type}", None)
        if handler:
            await handler(event)

    async def _on_MoneyDeposited(self, event: MoneyDeposited) -> None:
        await self.session.execute(
            update(account_balances)
            .where(account_balances.c.account_id == event.aggregate_id)
            .where(account_balances.c.event_version < event.version)
            .values(
                balance=account_balances.c.balance + event.amount,
                event_version=event.version
            )
        )
```

### Event Dispatcher

```python
class EventDispatcher:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}

    def register(self, event_type: str, handler: Callable) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    async def dispatch(self, event: DomainEvent) -> None:
        for handler in self._handlers.get(event.event_type, []):
            await handler(event)
```

## Projection Rebuilding

```python
class ProjectionRebuilder:
    def __init__(self, event_store: EventStore, session: AsyncSession):
        self.event_store = event_store
        self.session = session

    async def rebuild(self, projection_name: str, handler: Callable) -> None:
        # Clear read model
        await self.session.execute(delete(read_model_table))
        await self.session.execute(
            delete(checkpoints).where(checkpoints.c.name == projection_name)
        )

        # Replay all events
        processed = 0
        async for event in self.event_store.stream_all():
            await handler(event)
            processed += 1
            if processed % 1000 == 0:
                await self.session.commit()

        await self.session.commit()
        print(f"Rebuilt {projection_name}: {processed} events")
```
