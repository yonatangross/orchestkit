"""
Event Sourcing Template

Ready-to-use template with:
- Event base class
- Aggregate base class
- Event store interface
- Simple projection
"""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Iterable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Generic, TypeVar
from uuid import UUID, uuid4

# ============================================================
# EVENT BASE CLASS
# ============================================================

@dataclass(frozen=True)
class DomainEvent:
    """Base class for all domain events."""
    aggregate_id: UUID
    version: int
    event_id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def event_type(self) -> str:
        return self.__class__.__name__


# ============================================================
# AGGREGATE BASE CLASS
# ============================================================

E = TypeVar("E", bound=DomainEvent)


class Aggregate(ABC, Generic[E]):
    """Base class for event-sourced aggregates."""

    def __init__(self, aggregate_id: UUID | None = None):
        self._id = aggregate_id or uuid4()
        self._version = 0
        self._changes: list[E] = []

    @property
    def id(self) -> UUID:
        return self._id

    @property
    def version(self) -> int:
        return self._version

    @property
    def uncommitted_changes(self) -> list[E]:
        return self._changes.copy()

    def mark_committed(self) -> None:
        self._changes.clear()

    def load_from_history(self, events: Iterable[E]) -> None:
        for event in events:
            self._apply(event)
            self._version = event.version

    def _raise(self, event: E) -> None:
        self._apply(event)
        self._changes.append(event)

    def _next_version(self) -> int:
        return self._version + len(self._changes) + 1

    @abstractmethod
    def _apply(self, event: E) -> None:
        pass


# ============================================================
# EVENT STORE INTERFACE
# ============================================================

class ConcurrencyError(Exception):
    pass


class EventStore(ABC):
    @abstractmethod
    async def append(self, aggregate_id: UUID, events: list[DomainEvent], expected_version: int) -> None:
        pass

    @abstractmethod
    async def get_events(self, aggregate_id: UUID, after_version: int = 0) -> list[DomainEvent]:
        pass

    @abstractmethod
    def stream_all(self, after_event_id: UUID | None = None) -> AsyncIterator[DomainEvent]:
        pass


class InMemoryEventStore(EventStore):
    """In-memory event store for testing."""

    def __init__(self):
        self._events: dict[UUID, list[DomainEvent]] = {}
        self._all: list[DomainEvent] = []

    async def append(self, aggregate_id: UUID, events: list[DomainEvent], expected_version: int) -> None:
        current = self._events.get(aggregate_id, [])
        if (current[-1].version if current else 0) != expected_version:
            raise ConcurrencyError("Version mismatch")
        self._events.setdefault(aggregate_id, []).extend(events)
        self._all.extend(events)

    async def get_events(self, aggregate_id: UUID, after_version: int = 0) -> list[DomainEvent]:
        return [e for e in self._events.get(aggregate_id, []) if e.version > after_version]

    async def stream_all(self, after_event_id: UUID | None = None) -> AsyncIterator[DomainEvent]:
        for event in self._all:
            yield event


# ============================================================
# SIMPLE PROJECTION
# ============================================================

class Projection(ABC):
    @abstractmethod
    async def handle(self, event: DomainEvent) -> None:
        pass


# ============================================================
# REPOSITORY
# ============================================================

class Repository(Generic[E]):
    def __init__(self, event_store: EventStore, aggregate_class: type[Aggregate[E]]):
        self.event_store = event_store
        self.aggregate_class = aggregate_class

    async def load(self, aggregate_id: UUID) -> Aggregate[E]:
        events = await self.event_store.get_events(aggregate_id)
        aggregate = self.aggregate_class(aggregate_id)
        aggregate.load_from_history(events)  # type: ignore[arg-type]
        return aggregate

    async def save(self, aggregate: Aggregate[E]) -> None:
        if aggregate.uncommitted_changes:
            events: list[DomainEvent] = list(aggregate.uncommitted_changes)
            await self.event_store.append(aggregate.id, events, aggregate.version)
            aggregate.mark_committed()
