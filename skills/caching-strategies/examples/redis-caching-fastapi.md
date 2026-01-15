# Redis Caching with FastAPI

Complete examples for implementing caching in FastAPI with Redis.

## Setup

### Dependencies

```bash
pip install redis[hiredis] pydantic
```

### Redis Client Configuration

```python
# app/core/cache.py
from contextlib import asynccontextmanager
import redis.asyncio as redis
from fastapi import FastAPI, Request

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Redis connection pool."""
    app.state.redis = redis.from_url(
        "redis://localhost:6379",
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )

    # Verify connection
    await app.state.redis.ping()

    yield

    # Cleanup
    await app.state.redis.close()


app = FastAPI(lifespan=lifespan)


async def get_redis(request: Request) -> redis.Redis:
    """Dependency to get Redis client."""
    return request.app.state.redis
```

## Cache-Aside Implementation

### Generic Cache Service

```python
# app/services/cache.py
from typing import TypeVar, Callable, Generic
import json
from datetime import timedelta
import redis.asyncio as redis
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class CacheService(Generic[T]):
    """Cache-aside implementation with Pydantic models."""

    def __init__(
        self,
        redis_client: redis.Redis,
        prefix: str,
        model_class: type[T],
        default_ttl: int = 300,
    ):
        self.redis = redis_client
        self.prefix = prefix
        self.model_class = model_class
        self.default_ttl = default_ttl

    def _key(self, identifier: str) -> str:
        """Build cache key with prefix."""
        return f"{self.prefix}:{identifier}"

    async def get(self, identifier: str) -> T | None:
        """Get item from cache."""
        data = await self.redis.get(self._key(identifier))
        if data:
            return self.model_class.model_validate_json(data)
        return None

    async def set(
        self,
        identifier: str,
        value: T,
        ttl: int | None = None,
    ) -> None:
        """Set item in cache."""
        await self.redis.setex(
            self._key(identifier),
            ttl or self.default_ttl,
            value.model_dump_json(),
        )

    async def delete(self, identifier: str) -> None:
        """Delete item from cache."""
        await self.redis.delete(self._key(identifier))

    async def get_or_set(
        self,
        identifier: str,
        fetch_fn: Callable[[], T | None],
        ttl: int | None = None,
    ) -> T | None:
        """Get from cache or fetch and cache."""
        # Try cache first
        cached = await self.get(identifier)
        if cached:
            return cached

        # Cache miss - fetch from source
        data = await fetch_fn()
        if data:
            await self.set(identifier, data, ttl)

        return data

    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern."""
        keys = []
        async for key in self.redis.scan_iter(f"{self.prefix}:{pattern}"):
            keys.append(key)

        if keys:
            return await self.redis.delete(*keys)
        return 0
```

### Usage in Routes

```python
# app/api/v1/routes/analyses.py
from fastapi import APIRouter, Depends
from app.services.cache import CacheService
from app.schemas.analysis import AnalysisResponse
from app.services.analysis_service import AnalysisService

router = APIRouter()


async def get_analysis_cache(
    redis: redis.Redis = Depends(get_redis),
) -> CacheService[AnalysisResponse]:
    return CacheService(
        redis,
        prefix="analysis",
        model_class=AnalysisResponse,
        default_ttl=300,  # 5 minutes
    )


@router.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    cache: CacheService = Depends(get_analysis_cache),
    service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisResponse:
    """Get analysis with caching."""

    async def fetch():
        analysis = await service.get_by_id(analysis_id)
        return AnalysisResponse.from_domain(analysis) if analysis else None

    result = await cache.get_or_set(analysis_id, fetch)

    if not result:
        raise HTTPException(404, "Analysis not found")

    return result


@router.put("/analyses/{analysis_id}")
async def update_analysis(
    analysis_id: str,
    request: UpdateAnalysisRequest,
    cache: CacheService = Depends(get_analysis_cache),
    service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisResponse:
    """Update analysis and invalidate cache."""
    analysis = await service.update(analysis_id, request)

    # Invalidate cache
    await cache.delete(analysis_id)

    return AnalysisResponse.from_domain(analysis)
```

## Decorator-Based Caching

```python
# app/core/decorators.py
from functools import wraps
from typing import Callable, Any
import hashlib
import json

def cached(
    prefix: str,
    ttl: int = 300,
    key_builder: Callable[..., str] | None = None,
):
    """Decorator for caching function results."""

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get Redis from first arg (usually request or service)
            redis_client = None
            for arg in args:
                if hasattr(arg, "app"):
                    redis_client = arg.app.state.redis
                    break
                if hasattr(arg, "redis"):
                    redis_client = arg.redis
                    break

            if not redis_client:
                # No Redis available, skip caching
                return await func(*args, **kwargs)

            # Build cache key
            if key_builder:
                cache_key = f"{prefix}:{key_builder(*args, **kwargs)}"
            else:
                # Hash args for key
                key_data = json.dumps({
                    "args": [str(a) for a in args[1:]],  # Skip self/request
                    "kwargs": kwargs,
                }, sort_keys=True)
                key_hash = hashlib.md5(key_data.encode()).hexdigest()
                cache_key = f"{prefix}:{key_hash}"

            # Try cache
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)

            # Execute function
            result = await func(*args, **kwargs)

            # Cache result
            if result is not None:
                await redis_client.setex(
                    cache_key,
                    ttl,
                    json.dumps(result),
                )

            return result

        return wrapper
    return decorator


# Usage
class AnalysisService:
    def __init__(self, db: AsyncSession, redis: redis.Redis):
        self.db = db
        self.redis = redis

    @cached("analysis:stats", ttl=60)
    async def get_stats(self) -> dict:
        """Get analysis statistics (cached 1 minute)."""
        return await self._compute_stats()
```

## Cache Stampede Prevention

```python
# app/services/cache.py
import asyncio
from contextlib import asynccontextmanager


class CacheWithLock:
    """Cache with stampede prevention using Redis locks."""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    @asynccontextmanager
    async def lock(self, key: str, timeout: int = 10):
        """Acquire a distributed lock."""
        lock_key = f"lock:{key}"
        lock_value = str(uuid.uuid4())

        # Try to acquire lock
        acquired = await self.redis.set(
            lock_key,
            lock_value,
            nx=True,
            ex=timeout,
        )

        if not acquired:
            # Wait for lock holder to populate cache
            for _ in range(timeout * 10):
                await asyncio.sleep(0.1)
                if await self.redis.exists(key):
                    break
            yield False
            return

        try:
            yield True
        finally:
            # Release lock (only if we still own it)
            await self._release_lock(lock_key, lock_value)

    async def _release_lock(self, key: str, value: str):
        """Release lock atomically."""
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        await self.redis.eval(script, 1, key, value)

    async def get_or_set_with_lock(
        self,
        key: str,
        fetch_fn: Callable[[], T],
        ttl: int = 300,
    ) -> T:
        """Get from cache with stampede prevention."""
        # Try cache first
        cached = await self.redis.get(key)
        if cached:
            return json.loads(cached)

        # Acquire lock to prevent stampede
        async with self.lock(key) as got_lock:
            if got_lock:
                # We got the lock, check cache again
                cached = await self.redis.get(key)
                if cached:
                    return json.loads(cached)

                # Fetch and cache
                data = await fetch_fn()
                await self.redis.setex(key, ttl, json.dumps(data))
                return data
            else:
                # Lock was held, cache should be populated now
                cached = await self.redis.get(key)
                if cached:
                    return json.loads(cached)

                # Fallback: fetch directly
                return await fetch_fn()
```

## Cache Invalidation Strategies

### Event-Based Invalidation

```python
# app/events/handlers.py
from app.events import AnalysisUpdated, AnalysisDeleted

class CacheInvalidationHandler:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def handle_analysis_updated(self, event: AnalysisUpdated):
        """Invalidate cache when analysis is updated."""
        await self.redis.delete(f"analysis:{event.analysis_id}")

        # Invalidate related caches
        await self.redis.delete(f"analysis:list:user:{event.user_id}")
        await self.redis.delete("analysis:stats")

    async def handle_analysis_deleted(self, event: AnalysisDeleted):
        """Invalidate cache when analysis is deleted."""
        await self.redis.delete(f"analysis:{event.analysis_id}")
        await self.redis.delete(f"analysis:list:user:{event.user_id}")
```

### Version-Based Invalidation

```python
# app/services/cache.py
class VersionedCache:
    """Cache with version-based invalidation."""

    def __init__(self, redis_client: redis.Redis, namespace: str):
        self.redis = redis_client
        self.namespace = namespace

    async def _get_version(self) -> int:
        """Get current cache version."""
        version = await self.redis.get(f"{self.namespace}:version")
        return int(version) if version else 0

    async def _key(self, identifier: str) -> str:
        """Build versioned cache key."""
        version = await self._get_version()
        return f"{self.namespace}:v{version}:{identifier}"

    async def get(self, identifier: str) -> str | None:
        """Get from versioned cache."""
        key = await self._key(identifier)
        return await self.redis.get(key)

    async def set(self, identifier: str, value: str, ttl: int = 300):
        """Set in versioned cache."""
        key = await self._key(identifier)
        await self.redis.setex(key, ttl, value)

    async def invalidate_all(self):
        """Invalidate all cached items by incrementing version."""
        await self.redis.incr(f"{self.namespace}:version")
```

## Testing

```python
# tests/test_cache.py
import pytest
from unittest.mock import AsyncMock
from app.services.cache import CacheService

@pytest.fixture
def mock_redis():
    return AsyncMock()

@pytest.fixture
def cache_service(mock_redis):
    return CacheService(
        mock_redis,
        prefix="test",
        model_class=AnalysisResponse,
    )

@pytest.mark.asyncio
async def test_cache_miss_fetches_and_caches(cache_service, mock_redis):
    # Arrange
    mock_redis.get.return_value = None
    fetch_fn = AsyncMock(return_value=AnalysisResponse(id="123"))

    # Act
    result = await cache_service.get_or_set("123", fetch_fn)

    # Assert
    assert result.id == "123"
    fetch_fn.assert_called_once()
    mock_redis.setex.assert_called_once()

@pytest.mark.asyncio
async def test_cache_hit_returns_cached(cache_service, mock_redis):
    # Arrange
    cached_data = '{"id": "123"}'
    mock_redis.get.return_value = cached_data
    fetch_fn = AsyncMock()

    # Act
    result = await cache_service.get_or_set("123", fetch_fn)

    # Assert
    assert result.id == "123"
    fetch_fn.assert_not_called()
```
