---
title: "FastAPI: Lifespan & Health"
category: fastapi
impact: HIGH
impactDescription: Proper lifespan management prevents resource leaks and ensures clean startup/shutdown
tags: [fastapi, lifespan, health-check, settings, pydantic, exception-handler]
---

# FastAPI Lifespan & Health

## Lifespan Context Manager

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan with resource management."""
    # Startup
    app.state.db_engine = create_async_engine(
        settings.database_url, pool_size=5, max_overflow=10,
    )
    app.state.redis = redis.from_url(settings.redis_url)

    # Health check connections
    async with app.state.db_engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    await app.state.redis.ping()

    yield  # Application runs

    # Shutdown
    await app.state.db_engine.dispose()
    await app.state.redis.close()

app = FastAPI(lifespan=lifespan)
```

## Health Check Endpoint

```python
@health_router.get("/health")
async def health_check(request: Request):
    checks = {}
    try:
        async with request.app.state.db_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {e}"

    try:
        await request.app.state.redis.ping()
        checks["redis"] = "healthy"
    except Exception as e:
        checks["redis"] = f"unhealthy: {e}"

    status = "healthy" if all(v == "healthy" for v in checks.values()) else "unhealthy"
    return {"status": status, "checks": checks}
```

## Pydantic Settings

```python
from pydantic import Field, field_validator, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    database_url: PostgresDsn
    db_pool_size: int = Field(default=5, ge=1, le=20)
    redis_url: str = "redis://localhost:6379"
    api_key: str = Field(min_length=32)
    debug: bool = False

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if v and "+asyncpg" not in v:
            return v.replace("postgresql://", "postgresql+asyncpg://")
        return v
```

## Exception Handlers

```python
@app.exception_handler(ProblemException)
async def problem_exception_handler(request: Request, exc: ProblemException):
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.to_problem_detail(),
        media_type="application/problem+json",
    )
```

## Response Optimization

```python
from fastapi.responses import ORJSONResponse

app = FastAPI(default_response_class=ORJSONResponse)
```

**Incorrect — Creating resources at module level leads to connection leaks:**
```python
# Module-level connection (never closed!)
db_engine = create_async_engine(DATABASE_URL)

app = FastAPI()

@app.on_event("startup")  # Deprecated
async def startup():
    await db_engine.connect()
```

**Correct — Lifespan context manager ensures proper resource cleanup:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create resources
    app.state.db_engine = create_async_engine(DATABASE_URL)
    yield
    # Shutdown: guaranteed cleanup
    await app.state.db_engine.dispose()

app = FastAPI(lifespan=lifespan)
```
