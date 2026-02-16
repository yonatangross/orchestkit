---
title: "FastAPI: Dependencies"
category: fastapi
impact: HIGH
impactDescription: Dependency injection is the foundation of testable, maintainable FastAPI applications
tags: [fastapi, depends, dependency-injection, authentication, service-layer]
---

# FastAPI Dependency Injection

## Database Session Dependency

```python
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, Request

async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """Yield database session from app state."""
    async with AsyncSession(
        request.app.state.db_engine,
        expire_on_commit=False,
    ) as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

## Service Dependencies

```python
class AnalysisService:
    def __init__(self, db: AsyncSession, embeddings: EmbeddingsService, llm: LLMService):
        self.db = db
        self.embeddings = embeddings
        self.llm = llm

def get_analysis_service(
    db: AsyncSession = Depends(get_db),
    request: Request = None,
) -> AnalysisService:
    return AnalysisService(
        db=db,
        embeddings=request.app.state.embeddings,
        llm=request.app.state.llm,
    )

@router.post("/analyses")
async def create_analysis(
    data: AnalysisCreate,
    service: AnalysisService = Depends(get_analysis_service),
):
    return await service.create(data)
```

## Cached Settings

```python
from functools import lru_cache
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    api_key: str
    model_config = {"env_file": ".env"}

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

## Authentication Chain

```python
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_jwt(token)
    user = await db.get(User, payload["sub"])
    if not user:
        raise HTTPException(401, "Invalid credentials")
    return user

async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Admin access required")
    return user
```

**Incorrect — Manually creating dependencies couples code and breaks testability:**
```python
@router.post("/analyses")
async def create_analysis(data: AnalysisCreate, request: Request):
    db = AsyncSession(request.app.state.db_engine)
    service = AnalysisService(db)  # Cannot mock in tests
    return await service.create(data)
```

**Correct — Depends() enables dependency injection and easy testing:**
```python
@router.post("/analyses")
async def create_analysis(
    data: AnalysisCreate,
    service: AnalysisService = Depends(get_analysis_service),
):
    return await service.create(data)
# Tests can override get_analysis_service with mocks
```
