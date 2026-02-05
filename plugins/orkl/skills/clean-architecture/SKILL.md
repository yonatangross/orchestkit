---
name: clean-architecture
description: SOLID principles, hexagonal architecture, ports and adapters, and DDD tactical patterns for maintainable backends. Use when implementing clean architecture, decoupling services, separating domain logic, or creating testable architecture.
context: fork
agent: code-quality-reviewer
version: 1.0.0
tags: [architecture, solid, hexagonal, ddd, python, fastapi]
author: OrchestKit
user-invocable: false
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      command: "${CLAUDE_PLUGIN_ROOT}/src/hooks/bin/run-hook.mjs skill/backend-layer-validator"
    - matcher: "Write|Edit"
      command: "${CLAUDE_PLUGIN_ROOT}/src/hooks/bin/run-hook.mjs skill/import-direction-enforcer"
---

# Clean Architecture Patterns

Build maintainable, testable backends with SOLID principles and hexagonal architecture.

## SOLID Principles ( Python)

### S - Single Responsibility

```python
# BAD: One class doing everything
class UserManager:
    def create_user(self, data): ...
    def send_welcome_email(self, user): ...
    def generate_report(self, users): ...

# GOOD: Separate responsibilities
class UserService:
    def create_user(self, data: UserCreate) -> User: ...

class EmailService:
    def send_welcome(self, user: User) -> None: ...

class ReportService:
    def generate_user_report(self, users: list[User]) -> Report: ...
```

### O - Open/Closed (Protocol-based)

```python
from typing import Protocol

class PaymentProcessor(Protocol):
    async def process(self, amount: Decimal) -> PaymentResult: ...

class StripeProcessor:
    async def process(self, amount: Decimal) -> PaymentResult:
        # Stripe implementation
        ...

class PayPalProcessor:
    async def process(self, amount: Decimal) -> PaymentResult:
        # PayPal implementation - extends without modifying
        ...
```

### L - Liskov Substitution

```python
# Any implementation of Repository can substitute another
class IUserRepository(Protocol):
    async def get_by_id(self, id: str) -> User | None: ...
    async def save(self, user: User) -> User: ...

class PostgresUserRepository:
    async def get_by_id(self, id: str) -> User | None: ...
    async def save(self, user: User) -> User: ...

class InMemoryUserRepository:  # For testing - fully substitutable
    async def get_by_id(self, id: str) -> User | None: ...
    async def save(self, user: User) -> User: ...
```

### I - Interface Segregation

```python
# BAD: Fat interface
class IRepository(Protocol):
    async def get(self, id: str): ...
    async def save(self, entity): ...
    async def delete(self, id: str): ...
    async def search(self, query: str): ...
    async def bulk_insert(self, entities): ...

# GOOD: Segregated interfaces
class IReader(Protocol):
    async def get(self, id: str) -> T | None: ...

class IWriter(Protocol):
    async def save(self, entity: T) -> T: ...

class ISearchable(Protocol):
    async def search(self, query: str) -> list[T]: ...
```

### D - Dependency Inversion

```python
from typing import Protocol
from fastapi import Depends

class IAnalysisRepository(Protocol):
    async def get_by_id(self, id: str) -> Analysis | None: ...

class AnalysisService:
    def __init__(self, repo: IAnalysisRepository):
        self._repo = repo  # Depends on abstraction, not concrete

# FastAPI DI
def get_analysis_service(
    db: AsyncSession = Depends(get_db)
) -> AnalysisService:
    repo = PostgresAnalysisRepository(db)
    return AnalysisService(repo)
```

## Hexagonal Architecture (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────────┐
│                      DRIVING ADAPTERS                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ FastAPI  │  │   CLI    │  │  Celery  │  │  Tests   │    │
│  │ Routes   │  │ Commands │  │  Tasks   │  │  Mocks   │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       ▼             ▼             ▼             ▼           │
│  ╔═══════════════════════════════════════════════════════╗  │
│  ║                    INPUT PORTS                        ║  │
│  ║  ┌─────────────────┐  ┌─────────────────────────────┐ ║  │
│  ║  │ AnalysisService │  │ UserService                 │ ║  │
│  ║  │ (Use Cases)     │  │ (Use Cases)                 │ ║  │
│  ║  └────────┬────────┘  └──────────────┬──────────────┘ ║  │
│  ╠═══════════╪══════════════════════════╪════════════════╣  │
│  ║           ▼          DOMAIN          ▼                ║  │
│  ║  ┌─────────────────────────────────────────────────┐  ║  │
│  ║  │  Entities  │  Value Objects  │  Domain Events   │  ║  │
│  ║  │  Analysis  │  AnalysisType   │  AnalysisCreated │  ║  │
│  ║  └─────────────────────────────────────────────────┘  ║  │
│  ╠═══════════════════════════════════════════════════════╣  │
│  ║                   OUTPUT PORTS                        ║  │
│  ║  ┌──────────────────┐  ┌────────────────────────────┐ ║  │
│  ║  │ IAnalysisRepo    │  │ INotificationService       │ ║  │
│  ║  │ (Protocol)       │  │ (Protocol)                 │ ║  │
│  ║  └────────┬─────────┘  └──────────────┬─────────────┘ ║  │
│  ╚═══════════╪══════════════════════════╪════════════════╝  │
│              ▼                          ▼                   │
│  ┌───────────────────┐  ┌────────────────────────────────┐ │
│  │ PostgresRepo      │  │ EmailNotificationService       │ │
│  │ (SQLAlchemy)      │  │ (SMTP/SendGrid)                │ │
│  └───────────────────┘  └────────────────────────────────┘ │
│                      DRIVEN ADAPTERS                        │
└─────────────────────────────────────────────────────────────┘
```

## DDD Tactical Patterns

### Entity (Identity-based)

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

### Value Object (Structural equality)

```python
from dataclasses import dataclass

@dataclass(frozen=True)  # Immutable
class AnalysisType:
    category: str
    depth: int

    def __post_init__(self):
        if self.depth < 1 or self.depth > 3:
            raise ValueError("Depth must be 1-3")
```

### Aggregate Root

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

## Directory Structure

```
backend/app/
├── api/v1/              # Driving adapters (FastAPI routes)
├── domains/
│   └── analysis/
│       ├── entities.py      # Domain entities
│       ├── value_objects.py # Value objects
│       ├── services.py      # Domain services (use cases)
│       ├── repositories.py  # Output port protocols
│       └── events.py        # Domain events
├── infrastructure/
│   ├── repositories/    # Driven adapters (PostgreSQL)
│   ├── services/        # External service adapters
│   └── messaging/       # Event publishers
└── core/
    ├── dependencies.py  # FastAPI DI configuration
    └── protocols.py     # Shared protocols
```

## Anti-Patterns (FORBIDDEN)

```python
# NEVER import infrastructure in domain
from app.infrastructure.database import engine  # In domain layer

# NEVER leak ORM models to API
@router.get("/users/{id}")
async def get_user(id: str, db: Session) -> UserModel:  # Returns ORM model
    return db.query(UserModel).get(id)

# NEVER have domain depend on framework
from fastapi import HTTPException
class UserService:
    def get(self, id: str):
        if not user:
            raise HTTPException(404)  # Framework in domain!
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Protocol vs ABC | Use Protocol (structural typing) |
| Dataclass vs Pydantic | Dataclass for domain, Pydantic for API |
| Repository granularity | One per aggregate root |
| Transaction boundary | Service layer, not repository |
| Event publishing | Collect in aggregate, publish after commit |

## Related Skills

- `repository-patterns` - Detailed repository implementations
- `api-design-framework` - REST API patterns
- `database-schema-designer` - Schema design

## Capability Details

### solid-principles
**Keywords:** SOLID, single responsibility, open closed, liskov, interface segregation, dependency inversion
**Solves:**
- How do I apply SOLID principles in Python?
- My classes are doing too much

### hexagonal-architecture
**Keywords:** hexagonal, ports and adapters, clean architecture, onion
**Solves:**
- How do I structure my FastAPI app?
- How to separate infrastructure from domain?

### ddd-tactical
**Keywords:** entity, value object, aggregate, domain event, DDD
**Solves:**
- What's the difference between entity and value object?
- How to design aggregates?
