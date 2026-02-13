---
title: "Clean Architecture: DDD Tactical Patterns"
category: clean-architecture
impact: HIGH
---

# DDD Tactical Patterns

Domain-Driven Design tactical patterns for building rich domain models in Python.

## Entity (Identity-based)

Entities have a unique identity that persists across state changes.

```python
from dataclasses import dataclass, field
from uuid import UUID, uuid4
from datetime import datetime, timezone

@dataclass
class Analysis:
    id: UUID = field(default_factory=uuid4)
    source_url: str = ""
    status: AnalysisStatus = AnalysisStatus.PENDING
    summary: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Analysis):
            return False
        return self.id == other.id  # Identity equality, not structural

    def __hash__(self) -> int:
        return hash(self.id)
```

## Value Object (Structural equality)

Value objects are immutable and compared by their attributes, not identity.

```python
from dataclasses import dataclass

@dataclass(frozen=True)  # Immutable
class AnalysisType:
    category: str
    depth: int

    def __post_init__(self):
        if self.depth < 1 or self.depth > 3:
            raise ValueError("Depth must be 1-3")
        if not self.category:
            raise ValueError("Category cannot be empty")

@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str

    def __post_init__(self):
        if self.amount < 0:
            raise ValueError("Amount cannot be negative")

    def add(self, other: "Money") -> "Money":
        if self.currency != other.currency:
            raise ValueError(f"Cannot add {self.currency} and {other.currency}")
        return Money(self.amount + other.amount, self.currency)
```

## Aggregate Root

Aggregates enforce invariants and consistency boundaries. Access child entities only through the root.

```python
class AnalysisAggregate:
    def __init__(self, analysis: Analysis, artifacts: list[Artifact]):
        self._analysis = analysis
        self._artifacts = artifacts
        self._events: list[DomainEvent] = []

    @property
    def id(self) -> UUID:
        return self._analysis.id

    @property
    def status(self) -> AnalysisStatus:
        return self._analysis.status

    def complete(self, summary: str) -> None:
        """Complete the analysis - enforces business rules."""
        if self._analysis.status != AnalysisStatus.IN_PROGRESS:
            raise InvalidStateError("Can only complete in-progress analyses")
        if not self._artifacts:
            raise BusinessRuleViolation("Cannot complete without artifacts")

        self._analysis.status = AnalysisStatus.COMPLETED
        self._analysis.summary = summary
        self._events.append(AnalysisCompleted(self._analysis.id))

    def add_artifact(self, artifact: Artifact) -> None:
        """Add artifact - validates through aggregate root."""
        if len(self._artifacts) >= 100:
            raise BusinessRuleViolation("Maximum 100 artifacts per analysis")
        self._artifacts.append(artifact)
        self._events.append(ArtifactAdded(self._analysis.id, artifact.id))

    def collect_events(self) -> list[DomainEvent]:
        """Collect and clear domain events for publishing."""
        events = self._events.copy()
        self._events.clear()
        return events
```

## Domain Events

Events represent something significant that happened in the domain.

```python
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

@dataclass(frozen=True)
class DomainEvent:
    event_id: UUID = field(default_factory=uuid4)
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

@dataclass(frozen=True)
class AnalysisCreated(DomainEvent):
    analysis_id: UUID = field(default_factory=uuid4)
    source_url: str = ""

@dataclass(frozen=True)
class AnalysisCompleted(DomainEvent):
    analysis_id: UUID = field(default_factory=uuid4)
    summary: str = ""
```

## Domain Exceptions

Domain-specific exceptions that are independent of any framework.

```python
class DomainException(Exception):
    """Base exception for domain errors."""
    pass

class EntityNotFoundError(DomainException):
    def __init__(self, entity_type: str, entity_id: str):
        self.entity_type = entity_type
        self.entity_id = entity_id
        super().__init__(f"{entity_type} with id {entity_id} not found")

class InvalidStateError(DomainException):
    """Raised when an operation violates state machine rules."""
    pass

class BusinessRuleViolation(DomainException):
    """Raised when a business invariant is violated."""
    pass
```

## Domain Services

For operations that do not naturally belong to any single entity.

```python
class ScoringService:
    """Domain service - stateless, operates on domain objects."""

    def calculate_score(self, analysis: Analysis, artifacts: list[Artifact]) -> float:
        base_score = len(artifacts) * 10
        depth_multiplier = analysis.analysis_type.depth / 3.0
        return min(base_score * depth_multiplier, 100.0)
```

## Repository Pattern (Output Port)

Repositories define the interface for aggregate persistence. One repository per aggregate root.

```python
class IAnalysisRepository(Protocol):
    """Output port - defined in domain, implemented in infrastructure."""
    async def save(self, aggregate: AnalysisAggregate) -> AnalysisAggregate: ...
    async def get_by_id(self, id: UUID) -> AnalysisAggregate | None: ...
    async def find_by_status(self, status: AnalysisStatus) -> list[AnalysisAggregate]: ...
```

## Event Publishing Pattern

Collect events in aggregates, publish after successful persistence.

```python
class AnalysisService:
    def __init__(self, repo: IAnalysisRepository, publisher: IEventPublisher):
        self._repo = repo
        self._publisher = publisher

    async def complete_analysis(self, id: UUID, summary: str) -> None:
        aggregate = await self._repo.get_by_id(id)
        if not aggregate:
            raise EntityNotFoundError("Analysis", str(id))

        aggregate.complete(summary)  # Business logic + domain events
        await self._repo.save(aggregate)  # Persist

        # Publish events AFTER successful commit
        for event in aggregate.collect_events():
            await self._publisher.publish(event)
```
