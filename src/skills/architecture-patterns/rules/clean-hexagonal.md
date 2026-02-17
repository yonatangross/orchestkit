---
title: "Clean: Hexagonal Architecture"
category: clean
impact: HIGH
impactDescription: Hexagonal architecture decouples domain logic from infrastructure for testability
tags: [hexagonal, ports-adapters, clean-architecture, onion, driving, driven]
---

# Hexagonal Architecture (Ports & Adapters)

```
+-------------------------------------------------------------------+
|                      DRIVING ADAPTERS                               |
|  FastAPI Routes  |  CLI Commands  |  Celery Tasks  |  Tests/Mocks  |
|       |                |                |                |          |
|       v                v                v                v          |
|  +===============================================================+ |
|  |                    INPUT PORTS                                 | |
|  |  AnalysisService (Use Cases)  |  UserService (Use Cases)      | |
|  +===============================================================+ |
|  |                      DOMAIN                                    | |
|  |  Entities  |  Value Objects  |  Domain Events                  | |
|  +===============================================================+ |
|  |                   OUTPUT PORTS                                 | |
|  |  IAnalysisRepo (Protocol)  |  INotificationService (Protocol) | |
|  +===============================================================+ |
|       |                                        |                    |
|       v                                        v                    |
|  PostgresRepo (SQLAlchemy)     EmailNotificationService (SMTP)      |
|                      DRIVEN ADAPTERS                                |
+-------------------------------------------------------------------+
```

## Directory Structure

```
backend/app/
├── api/v1/              # Driving adapters (FastAPI routes)
├── domains/
│   └── analysis/
│       ├── entities.py      # Domain entities
│       ├── value_objects.py  # Value objects
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

## Key Principles

- Domain layer has **zero** external dependencies
- Input ports define use cases (service interfaces)
- Output ports define infrastructure needs (repository protocols)
- Driving adapters call inward (routes -> services)
- Driven adapters are called outward (services -> repositories)

**Incorrect — domain layer importing infrastructure:**
```typescript
// In domains/analysis/services.py
from infrastructure.repositories.postgres import PostgresAnalysisRepository  // Violates hex arch

class AnalysisService:
    def __init__(self):
        self.repo = PostgresAnalysisRepository()
```

**Correct — domain depends only on ports:**
```typescript
// In domains/analysis/repositories.py (port)
class IAnalysisRepository(Protocol):
    async def get_by_id(self, id: str) -> Analysis | None: ...

// In domains/analysis/services.py
class AnalysisService:
    def __init__(self, repo: IAnalysisRepository):  // Depends on port only
        self._repo = repo
```
