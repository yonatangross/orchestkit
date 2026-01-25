# FastAPI Clean Architecture Example

Complete example implementing clean architecture patterns in FastAPI.

## Project Structure

```
backend/
├── app/
│   ├── api/v1/
│   │   ├── routes/
│   │   │   └── analyses.py      # Driving adapter
│   │   ├── schemas/
│   │   │   └── analysis.py      # DTOs
│   │   └── deps.py              # DI configuration
│   ├── application/
│   │   ├── services/
│   │   │   └── analysis_service.py
│   │   └── ports/
│   │       └── repositories.py   # Output ports
│   ├── domain/
│   │   ├── entities/
│   │   │   └── analysis.py
│   │   └── value_objects/
│   │       └── analysis_type.py
│   └── infrastructure/
│       └── persistence/
│           ├── models/
│           │   └── analysis_model.py
│           └── repositories/
│               └── postgres_analysis_repo.py
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

## Domain Layer

### Entity

```python
# domain/entities/analysis.py
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

class AnalysisStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class Analysis:
    """Aggregate root for analysis domain."""

    source_url: str
    status: AnalysisStatus = AnalysisStatus.PENDING
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    summary: str | None = None
    error_message: str | None = None

    def start_processing(self) -> None:
        if self.status != AnalysisStatus.PENDING:
            raise ValueError(f"Cannot start processing from {self.status}")
        self.status = AnalysisStatus.PROCESSING

    def complete(self, summary: str) -> None:
        if self.status != AnalysisStatus.PROCESSING:
            raise ValueError(f"Cannot complete from {self.status}")
        self.status = AnalysisStatus.COMPLETED
        self.summary = summary

    def fail(self, error: str) -> None:
        self.status = AnalysisStatus.FAILED
        self.error_message = error

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Analysis):
            return False
        return self.id == other.id
```

### Value Object

```python
# domain/value_objects/analysis_type.py
from dataclasses import dataclass
from enum import Enum

class ContentType(Enum):
    ARTICLE = "article"
    VIDEO = "video"
    GITHUB_REPO = "github_repo"

@dataclass(frozen=True)
class AnalysisType:
    """Immutable value object for analysis configuration."""

    content_type: ContentType
    depth: int  # 1-3

    def __post_init__(self):
        if not 1 <= self.depth <= 3:
            raise ValueError(f"Depth must be 1-3, got {self.depth}")

    @property
    def is_deep(self) -> bool:
        return self.depth == 3
```

## Application Layer

### Output Port (Protocol)

```python
# application/ports/repositories.py
from typing import Protocol
from app.domain.entities.analysis import Analysis

class IAnalysisRepository(Protocol):
    """Output port for analysis persistence."""

    async def save(self, analysis: Analysis) -> Analysis:
        """Persist an analysis."""
        ...

    async def get_by_id(self, id: str) -> Analysis | None:
        """Retrieve analysis by ID."""
        ...

    async def find_by_status(self, status: str) -> list[Analysis]:
        """Find all analyses with given status."""
        ...
```

### Application Service (Use Case)

```python
# application/services/analysis_service.py
from app.application.ports.repositories import IAnalysisRepository
from app.domain.entities.analysis import Analysis

class AnalysisService:
    """Application service implementing use cases."""

    def __init__(self, repo: IAnalysisRepository):
        self._repo = repo

    async def create_analysis(self, url: str) -> Analysis:
        """Create a new analysis."""
        analysis = Analysis(source_url=url)
        return await self._repo.save(analysis)

    async def get_analysis(self, id: str) -> Analysis | None:
        """Get analysis by ID."""
        return await self._repo.get_by_id(id)

    async def start_processing(self, id: str) -> Analysis:
        """Start processing an analysis."""
        analysis = await self._repo.get_by_id(id)
        if not analysis:
            raise ValueError(f"Analysis {id} not found")

        analysis.start_processing()
        return await self._repo.save(analysis)

    async def complete_analysis(self, id: str, summary: str) -> Analysis:
        """Mark analysis as complete."""
        analysis = await self._repo.get_by_id(id)
        if not analysis:
            raise ValueError(f"Analysis {id} not found")

        analysis.complete(summary)
        return await self._repo.save(analysis)
```

## Infrastructure Layer

### ORM Model

```python
# infrastructure/persistence/models/analysis_model.py
from sqlalchemy import String, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import uuid

from app.domain.entities.analysis import Analysis, AnalysisStatus
from app.infrastructure.persistence.base import Base

class AnalysisModel(Base):
    """SQLAlchemy model for analysis."""

    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    source_url: Mapped[str] = mapped_column(String(2048))
    status: Mapped[str] = mapped_column(
        SQLEnum(AnalysisStatus, name="analysis_status")
    )
    summary: Mapped[str | None] = mapped_column(String, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    @classmethod
    def from_domain(cls, analysis: Analysis) -> "AnalysisModel":
        """Map domain entity to ORM model."""
        return cls(
            id=analysis.id,
            source_url=analysis.source_url,
            status=analysis.status,
            summary=analysis.summary,
            error_message=analysis.error_message,
            created_at=analysis.created_at,
        )

    def to_domain(self) -> Analysis:
        """Map ORM model to domain entity."""
        return Analysis(
            id=self.id,
            source_url=self.source_url,
            status=AnalysisStatus(self.status),
            summary=self.summary,
            error_message=self.error_message,
            created_at=self.created_at,
        )
```

### Repository Implementation (Driven Adapter)

```python
# infrastructure/persistence/repositories/postgres_analysis_repo.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.ports.repositories import IAnalysisRepository
from app.domain.entities.analysis import Analysis, AnalysisStatus
from app.infrastructure.persistence.models.analysis_model import AnalysisModel

class PostgresAnalysisRepository:
    """PostgreSQL implementation of IAnalysisRepository."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, analysis: Analysis) -> Analysis:
        model = AnalysisModel.from_domain(analysis)
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return model.to_domain()

    async def get_by_id(self, id: str) -> Analysis | None:
        stmt = select(AnalysisModel).where(AnalysisModel.id == id)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return model.to_domain() if model else None

    async def find_by_status(self, status: str) -> list[Analysis]:
        stmt = select(AnalysisModel).where(
            AnalysisModel.status == AnalysisStatus(status)
        )
        result = await self._session.execute(stmt)
        return [m.to_domain() for m in result.scalars()]
```

## API Layer (Driving Adapter)

### Schemas (DTOs)

```python
# api/v1/schemas/analysis.py
from pydantic import BaseModel, HttpUrl, ConfigDict
from datetime import datetime

class CreateAnalysisRequest(BaseModel):
    """Request DTO for creating analysis."""
    url: HttpUrl

class AnalysisResponse(BaseModel):
    """Response DTO for analysis."""
    id: str
    source_url: str
    status: str
    summary: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_domain(cls, analysis) -> "AnalysisResponse":
        return cls(
            id=str(analysis.id),
            source_url=analysis.source_url,
            status=analysis.status.value,
            summary=analysis.summary,
            created_at=analysis.created_at,
        )
```

### Dependencies

```python
# api/v1/deps.py
from typing import AsyncGenerator
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.analysis_service import AnalysisService
from app.infrastructure.persistence.repositories.postgres_analysis_repo import (
    PostgresAnalysisRepository
)

async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSession(request.app.state.db_engine) as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

def get_analysis_service(
    db: AsyncSession = Depends(get_db)
) -> AnalysisService:
    repo = PostgresAnalysisRepository(db)
    return AnalysisService(repo)
```

### Routes

```python
# api/v1/routes/analyses.py
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.deps import get_analysis_service
from app.api.v1.schemas.analysis import (
    CreateAnalysisRequest,
    AnalysisResponse
)
from app.application.services.analysis_service import AnalysisService

router = APIRouter(prefix="/analyses", tags=["analyses"])

@router.post("/", response_model=AnalysisResponse, status_code=201)
async def create_analysis(
    request: CreateAnalysisRequest,
    service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisResponse:
    """Create a new analysis."""
    analysis = await service.create_analysis(str(request.url))
    return AnalysisResponse.from_domain(analysis)

@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: str,
    service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisResponse:
    """Get analysis by ID."""
    analysis = await service.get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis {analysis_id} not found"
        )
    return AnalysisResponse.from_domain(analysis)
```

## Tests

### Unit Test (Domain)

```python
# tests/unit/domain/test_analysis.py
import pytest
from app.domain.entities.analysis import Analysis, AnalysisStatus

def test_analysis_starts_processing():
    analysis = Analysis(source_url="https://example.com")

    analysis.start_processing()

    assert analysis.status == AnalysisStatus.PROCESSING

def test_analysis_cannot_start_if_not_pending():
    analysis = Analysis(source_url="https://example.com")
    analysis.status = AnalysisStatus.COMPLETED

    with pytest.raises(ValueError):
        analysis.start_processing()

def test_analysis_completes_with_summary():
    analysis = Analysis(source_url="https://example.com")
    analysis.start_processing()

    analysis.complete("Analysis complete")

    assert analysis.status == AnalysisStatus.COMPLETED
    assert analysis.summary == "Analysis complete"
```

### Integration Test (Service)

```python
# tests/integration/test_analysis_service.py
import pytest
from unittest.mock import AsyncMock

from app.application.services.analysis_service import AnalysisService
from app.domain.entities.analysis import Analysis, AnalysisStatus

@pytest.fixture
def mock_repo():
    return AsyncMock()

@pytest.fixture
def service(mock_repo):
    return AnalysisService(repo=mock_repo)

async def test_create_analysis(service, mock_repo):
    mock_repo.save.return_value = Analysis(source_url="https://example.com")

    result = await service.create_analysis("https://example.com")

    assert result.source_url == "https://example.com"
    assert result.status == AnalysisStatus.PENDING
    mock_repo.save.assert_called_once()
```
