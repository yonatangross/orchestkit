# Hexagonal Architecture (Ports & Adapters)

Comprehensive guide to implementing hexagonal architecture in Python/FastAPI backends.

## Core Concepts

### Ports
Interfaces (Python Protocols) that define how the application core communicates with the outside world.

**Driving Ports (Primary)**: How the outside world calls the application
```python
# Input port - what the application offers
class IAnalysisService(Protocol):
    async def create_analysis(self, request: CreateAnalysisRequest) -> Analysis: ...
    async def get_analysis(self, id: str) -> Analysis | None: ...
```

**Driven Ports (Secondary)**: How the application calls external systems
```python
# Output port - what the application needs
class IAnalysisRepository(Protocol):
    async def save(self, analysis: Analysis) -> Analysis: ...
    async def get_by_id(self, id: str) -> Analysis | None: ...

class INotificationService(Protocol):
    async def send(self, user_id: str, message: str) -> None: ...
```

### Adapters
Concrete implementations that connect ports to external systems.

**Driving Adapters (Primary)**: Translate external requests into application calls
```python
# FastAPI route adapter
@router.post("/analyses")
async def create_analysis(
    request: AnalyzeRequest,
    service: IAnalysisService = Depends(get_analysis_service)
) -> AnalysisResponse:
    analysis = await service.create_analysis(request.to_domain())
    return AnalysisResponse.from_domain(analysis)
```

**Driven Adapters (Secondary)**: Implement ports using external technologies
```python
# PostgreSQL adapter
class PostgresAnalysisRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, analysis: Analysis) -> Analysis:
        model = AnalysisModel.from_domain(analysis)
        self._session.add(model)
        await self._session.flush()
        return model.to_domain()
```

## Layer Structure

```
┌──────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  FastAPI    │  │  PostgreSQL │  │   Redis     │              │
│  │  Routes     │  │  Repository │  │   Cache     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                     APPLICATION LAYER                        ││
│  │  ┌────────────────────────────────────────────────────────┐  ││
│  │  │              Use Cases / Application Services          │  ││
│  │  │  ┌──────────────────┐  ┌──────────────────────────┐   │  ││
│  │  │  │ AnalysisService  │  │ UserService               │   │  ││
│  │  │  │ - create()       │  │ - register()              │   │  ││
│  │  │  │ - process()      │  │ - authenticate()          │   │  ││
│  │  │  └──────────────────┘  └──────────────────────────┘   │  ││
│  │  └────────────────────────────────────────────────────────┘  ││
│  │                                                              ││
│  │  ┌────────────────────────────────────────────────────────┐  ││
│  │  │                    DOMAIN LAYER                        │  ││
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │  ││
│  │  │  │   Entities   │  │ Value Objects│  │   Events    │  │  ││
│  │  │  │   Analysis   │  │ AnalysisType │  │ Completed   │  │  ││
│  │  │  └──────────────┘  └──────────────┘  └─────────────┘  │  ││
│  │  │                                                        │  ││
│  │  │  ┌──────────────────────────────────────────────────┐  │  ││
│  │  │  │              Domain Services                     │  │  ││
│  │  │  │  ScoringService, ValidationService               │  │  ││
│  │  │  └──────────────────────────────────────────────────┘  │  ││
│  │  └────────────────────────────────────────────────────────┘  ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## Directory Mapping

```
backend/app/
├── api/v1/                      # Driving adapters
│   ├── routes/
│   │   ├── analyses.py          # HTTP adapter
│   │   └── users.py
│   ├── schemas/                 # DTOs (request/response)
│   │   ├── analysis.py
│   │   └── user.py
│   └── deps.py                  # Dependency injection
│
├── application/                 # Application layer
│   ├── services/               # Use cases
│   │   ├── analysis_service.py
│   │   └── user_service.py
│   └── ports/                  # Port definitions
│       ├── repositories.py     # Output ports
│       └── services.py         # External service ports
│
├── domain/                      # Domain layer (pure Python)
│   ├── entities/
│   │   ├── analysis.py         # Aggregate root
│   │   └── artifact.py         # Entity
│   ├── value_objects/
│   │   ├── analysis_type.py
│   │   └── url.py
│   ├── events/
│   │   └── analysis_events.py
│   └── services/               # Domain services
│       └── scoring_service.py
│
└── infrastructure/              # Driven adapters
    ├── persistence/
    │   ├── models/             # ORM models
    │   ├── repositories/       # Repository implementations
    │   └── mappers/            # Domain ↔ ORM mappers
    ├── cache/
    │   └── redis_cache.py
    └── external/
        └── llm_client.py
```

## Dependency Rule

**Dependencies point inward**. Outer layers depend on inner layers, never the reverse.

```
Infrastructure → Application → Domain
      ↓               ↓           ↓
  (knows)        (knows)    (knows nothing)
```

### Import Rules

```python
# ✅ ALLOWED: Infrastructure imports from Application
# infrastructure/repositories/postgres_analysis_repo.py
from app.application.ports.repositories import IAnalysisRepository
from app.domain.entities.analysis import Analysis

# ✅ ALLOWED: Application imports from Domain
# application/services/analysis_service.py
from app.domain.entities.analysis import Analysis
from app.domain.events import AnalysisCreated

# ❌ FORBIDDEN: Domain imports from Application or Infrastructure
# domain/entities/analysis.py
from app.infrastructure.database import engine  # NEVER!
from app.application.services import something  # NEVER!
```

## Testing Strategy

### Unit Tests (Domain Layer)
```python
# No mocks needed - pure Python
def test_analysis_completes():
    analysis = Analysis(id="123", status=AnalysisStatus.PENDING)
    analysis.complete(summary="Done")
    assert analysis.status == AnalysisStatus.COMPLETED
```

### Integration Tests (Application Layer)
```python
# Mock driven ports only
async def test_create_analysis():
    mock_repo = Mock(spec=IAnalysisRepository)
    mock_repo.save.return_value = Analysis(id="123")

    service = AnalysisService(repo=mock_repo)
    result = await service.create(CreateAnalysisRequest(url="..."))

    assert result.id == "123"
    mock_repo.save.assert_called_once()
```

### E2E Tests (Driving Adapters)
```python
# Full stack with test database
async def test_create_analysis_endpoint(client: TestClient, db: AsyncSession):
    response = await client.post("/api/v1/analyses", json={"url": "..."})
    assert response.status_code == 201
```

## Related Files

- See `checklists/solid-checklist.md` for SOLID principles checklist
- See `scripts/domain-entity-template.py` for entity templates
- See SKILL.md for DDD patterns
