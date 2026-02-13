# Domain Events

## Event Definition

```python
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import ClassVar
from uuid import UUID

from uuid_utils import uuid7  # UUIDv7 for time-ordered event IDs


@dataclass(frozen=True)
class DomainEvent:
    """Base class for domain events.

    Uses UUIDv7 for time-ordered, sortable event IDs.
    """

    event_id: UUID = field(default_factory=uuid7)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    event_type: ClassVar[str]

    def to_dict(self) -> dict:
        """Serialize event for publishing."""
        return {
            "event_id": str(self.event_id),
            "event_type": self.event_type,
            "occurred_at": self.occurred_at.isoformat(),
            "payload": self._payload(),
        }

    def _payload(self) -> dict:
        """Override to provide event-specific payload."""
        return {}


@dataclass(frozen=True)
class UserCreated(DomainEvent):
    """Emitted when a new user is created."""

    event_type: ClassVar[str] = "user.created"
    user_id: UUID = field(default_factory=uuid7)
    email: str = ""

    def _payload(self) -> dict:
        return {"user_id": str(self.user_id), "email": self.email}


@dataclass(frozen=True)
class UserActivated(DomainEvent):
    """Emitted when user account is activated."""

    event_type: ClassVar[str] = "user.activated"
    user_id: UUID = field(default_factory=uuid7)

    def _payload(self) -> dict:
        return {"user_id": str(self.user_id)}


@dataclass(frozen=True)
class OrderPlaced(DomainEvent):
    """Emitted when an order is placed."""

    event_type: ClassVar[str] = "order.placed"
    order_id: UUID = field(default_factory=uuid7)
    customer_id: UUID = field(default_factory=uuid7)
    total_amount: str = "0.00"
    currency: str = "USD"

    def _payload(self) -> dict:
        return {
            "order_id": str(self.order_id),
            "customer_id": str(self.customer_id),
            "total": {"amount": self.total_amount, "currency": self.currency},
        }
```

## Entity Event Collection

```python
@dataclass
class Entity:
    """Base entity with event collection."""

    _domain_events: list[DomainEvent] = field(default_factory=list, repr=False)

    def add_event(self, event: DomainEvent) -> None:
        """Register domain event for later publishing."""
        self._domain_events.append(event)

    def collect_events(self) -> list[DomainEvent]:
        """Collect and clear pending events."""
        events = self._domain_events.copy()
        self._domain_events.clear()
        return events


@dataclass
class Order(Entity):
    """Order with domain events."""

    id: UUID = field(default_factory=uuid7)
    customer_id: UUID = field(default_factory=uuid7)
    status: str = "draft"

    def place(self) -> None:
        """Place the order."""
        if self.status != "draft":
            raise ValueError("Can only place draft orders")

        self.status = "placed"
        self.add_event(OrderPlaced(
            order_id=self.id,
            customer_id=self.customer_id,
            total_amount=str(self.total.amount),
            currency=self.total.currency,
        ))
```

## Event Publisher

```python
from abc import abstractmethod
from typing import Protocol


class EventPublisher(Protocol):
    """Protocol for publishing domain events."""

    @abstractmethod
    async def publish(self, event: DomainEvent) -> None:
        """Publish single event."""
        ...

    @abstractmethod
    async def publish_all(self, events: list[DomainEvent]) -> None:
        """Publish multiple events."""
        ...


class InMemoryEventPublisher(EventPublisher):
    """In-memory publisher for testing."""

    def __init__(self):
        self.events: list[DomainEvent] = []

    async def publish(self, event: DomainEvent) -> None:
        self.events.append(event)

    async def publish_all(self, events: list[DomainEvent]) -> None:
        self.events.extend(events)


class RedisEventPublisher(EventPublisher):
    """Redis Streams event publisher."""

    def __init__(self, redis_client, stream_name: str = "domain-events"):
        self._redis = redis_client
        self._stream = stream_name

    async def publish(self, event: DomainEvent) -> None:
        await self._redis.xadd(
            self._stream,
            event.to_dict(),
        )

    async def publish_all(self, events: list[DomainEvent]) -> None:
        async with self._redis.pipeline() as pipe:
            for event in events:
                pipe.xadd(self._stream, event.to_dict())
            await pipe.execute()
```

## Service Layer Event Publishing

```python
class OrderService:
    """Application service that publishes domain events."""

    def __init__(
        self,
        order_repo: OrderRepository,
        event_publisher: EventPublisher,
    ):
        self._orders = order_repo
        self._events = event_publisher

    async def place_order(self, order_id: UUID) -> Order:
        """Place order and publish events."""
        order = await self._orders.get_or_raise(order_id)

        # Business logic (adds events to entity)
        order.place()

        # Persist changes
        await self._orders.update(order)

        # Publish collected events
        events = order.collect_events()
        await self._events.publish_all(events)

        return order
```

## Event Handlers

```python
from typing import Callable, TypeVar

E = TypeVar("E", bound=DomainEvent)


class EventDispatcher:
    """Dispatch events to registered handlers."""

    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}

    def register(
        self,
        event_type: str,
        handler: Callable[[DomainEvent], None],
    ) -> None:
        """Register handler for event type."""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    async def dispatch(self, event: DomainEvent) -> None:
        """Dispatch event to all registered handlers."""
        handlers = self._handlers.get(event.event_type, [])
        for handler in handlers:
            await handler(event)


# Handler registration
dispatcher = EventDispatcher()


async def send_welcome_email(event: UserCreated) -> None:
    """Send welcome email on user creation."""
    await email_service.send_welcome(event.email)


async def update_analytics(event: UserCreated) -> None:
    """Update analytics on user creation."""
    await analytics.track("user_created", {"user_id": str(event.user_id)})


dispatcher.register("user.created", send_welcome_email)
dispatcher.register("user.created", update_analytics)
```
