---
title: Model complex domains with DDD tactical patterns using clear boundaries and rich logic
category: clean
impact: HIGH
impactDescription: DDD patterns model complex domains with clear boundaries and rich domain logic
tags: [ddd, entity, value-object, aggregate, domain-event, tactical-patterns]
---

# DDD Tactical Patterns

## Entity (Identity-based)

```python
from dataclasses import dataclass, field
from uuid import UUID, uuid4

@dataclass
class Analysis:
    id: UUID = field(default_factory=uuid4)
    source_url: str
    status: AnalysisStatus
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Analysis):
            return False
        return self.id == other.id  # Identity equality
```

## Value Object (Structural equality)

```python
@dataclass(frozen=True)  # Immutable
class AnalysisType:
    category: str
    depth: int

    def __post_init__(self):
        if self.depth < 1 or self.depth > 3:
            raise ValueError("Depth must be 1-3")
```

## Aggregate Root

```python
class AnalysisAggregate:
    def __init__(self, analysis: Analysis, artifacts: list[Artifact]):
        self._analysis = analysis
        self._artifacts = artifacts
        self._events: list[DomainEvent] = []

    def complete(self, summary: str) -> None:
        self._analysis.status = AnalysisStatus.COMPLETED
        self._analysis.summary = summary
        self._events.append(AnalysisCompleted(self._analysis.id))

    def collect_events(self) -> list[DomainEvent]:
        events = self._events.copy()
        self._events.clear()
        return events
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Repository granularity | One per aggregate root |
| Transaction boundary | Service layer, not repository |
| Event publishing | Collect in aggregate, publish after commit |

**Incorrect — mutable value object violates immutability:**
```typescript
@dataclass
class AnalysisType:  // Mutable by default
    category: str
    depth: int

analysis_type = AnalysisType("security", 2)
analysis_type.depth = 5  // Can mutate, breaks value object contract
```

**Correct — frozen dataclass ensures immutability:**
```typescript
@dataclass(frozen=True)  // Immutable
class AnalysisType:
    category: str
    depth: int

analysis_type = AnalysisType("security", 2)
analysis_type.depth = 5  // FrozenInstanceError
```
