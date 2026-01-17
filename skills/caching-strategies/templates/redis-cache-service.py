"""
Redis Cache Service Template

Production-ready cache service with:
- Cache-aside pattern
- Stampede prevention
- Automatic serialization
- Pattern-based invalidation
"""

import asyncio
import hashlib
import json
import uuid
from collections.abc import Callable
from typing import Any, Generic, TypeVar

import redis.asyncio as redis
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


# ============================================================================
# Cache Result
# ============================================================================

class CacheResult(Generic[T]):
    """Result of a cache operation."""

    def __init__(
        self,
        value: T | None,
        hit: bool,
        key: str,
        ttl_remaining: int | None = None,
    ):
        self.value = value
        self.hit = hit
        self.key = key
        self.ttl_remaining = ttl_remaining

    @property
    def miss(self) -> bool:
        return not self.hit


# ============================================================================
# Cache Service
# ============================================================================

class CacheService(Generic[T]):
    """
    Generic cache service with cache-aside pattern.

    Features:
    - Pydantic model serialization
    - Pattern-based invalidation
    - Metrics tracking
    - Stampede prevention
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        prefix: str,
        model_class: type[T],
        default_ttl: int = 300,
        enable_metrics: bool = True,
    ):
        self.redis = redis_client
        self.prefix = prefix
        self.model_class = model_class
        self.default_ttl = default_ttl
        self.enable_metrics = enable_metrics

        # Metrics counters
        self._hits = 0
        self._misses = 0

    # -------------------------------------------------------------------------
    # Key Management
    # -------------------------------------------------------------------------

    def _key(self, identifier: str) -> str:
        """Build cache key with prefix."""
        return f"{self.prefix}:{identifier}"

    def _lock_key(self, identifier: str) -> str:
        """Build lock key for stampede prevention."""
        return f"lock:{self.prefix}:{identifier}"

    @staticmethod
    def hash_key(*args, **kwargs) -> str:
        """Generate hash-based key from arguments."""
        data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True)
        return hashlib.md5(data.encode()).hexdigest()[:12]

    # -------------------------------------------------------------------------
    # Core Operations
    # -------------------------------------------------------------------------

    async def get(self, identifier: str) -> CacheResult[T]:
        """
        Get item from cache.

        Returns CacheResult with hit/miss status.
        """
        key = self._key(identifier)

        # Get value and TTL in one round trip
        pipe = self.redis.pipeline()
        pipe.get(key)
        pipe.ttl(key)
        results = await pipe.execute()

        data, ttl = results[0], results[1]

        if data:
            self._hits += 1
            value = self.model_class.model_validate_json(data)
            return CacheResult(
                value=value,
                hit=True,
                key=key,
                ttl_remaining=ttl if ttl > 0 else None,
            )

        self._misses += 1
        return CacheResult(value=None, hit=False, key=key)

    async def set(
        self,
        identifier: str,
        value: T,
        ttl: int | None = None,
    ) -> None:
        """Set item in cache with TTL."""
        key = self._key(identifier)
        await self.redis.setex(
            key,
            ttl or self.default_ttl,
            value.model_dump_json(),
        )

    async def delete(self, identifier: str) -> bool:
        """Delete item from cache. Returns True if deleted."""
        key = self._key(identifier)
        result = await self.redis.delete(key)
        return result > 0

    async def exists(self, identifier: str) -> bool:
        """Check if key exists in cache."""
        key = self._key(identifier)
        return await self.redis.exists(key) > 0

    # -------------------------------------------------------------------------
    # Cache-Aside Pattern
    # -------------------------------------------------------------------------

    async def get_or_set(
        self,
        identifier: str,
        fetch_fn: Callable[[], T | None],
        ttl: int | None = None,
        skip_cache: bool = False,
    ) -> T | None:
        """
        Get from cache or fetch and cache.

        Args:
            identifier: Cache key identifier
            fetch_fn: Async function to fetch data on miss
            ttl: Optional TTL override
            skip_cache: If True, always fetch fresh data
        """
        if not skip_cache:
            result = await self.get(identifier)
            if result.hit:
                return result.value

        # Cache miss - fetch from source
        data = await fetch_fn()

        if data is not None:
            await self.set(identifier, data, ttl)

        return data

    async def get_or_set_with_lock(
        self,
        identifier: str,
        fetch_fn: Callable[[], T | None],
        ttl: int | None = None,
        lock_timeout: int = 10,
    ) -> T | None:
        """
        Get from cache with stampede prevention.

        Uses distributed lock to prevent multiple concurrent fetches.
        """
        # Try cache first
        result = await self.get(identifier)
        if result.hit:
            return result.value

        # Try to acquire lock
        lock_key = self._lock_key(identifier)
        lock_value = str(uuid.uuid4())

        acquired = await self.redis.set(
            lock_key,
            lock_value,
            nx=True,
            ex=lock_timeout,
        )

        if acquired:
            try:
                # Double-check cache after acquiring lock
                result = await self.get(identifier)
                if result.hit:
                    return result.value

                # Fetch and cache
                data = await fetch_fn()
                if data is not None:
                    await self.set(identifier, data, ttl)
                return data

            finally:
                # Release lock
                await self._release_lock(lock_key, lock_value)
        else:
            # Wait for lock holder to populate cache
            for _ in range(lock_timeout * 10):
                await asyncio.sleep(0.1)
                result = await self.get(identifier)
                if result.hit:
                    return result.value

            # Timeout - fetch directly
            return await fetch_fn()

    async def _release_lock(self, key: str, value: str) -> None:
        """Release lock atomically (only if we still own it)."""
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        await self.redis.eval(script, 1, key, value)

    # -------------------------------------------------------------------------
    # Batch Operations
    # -------------------------------------------------------------------------

    async def get_many(self, identifiers: list[str]) -> dict[str, T | None]:
        """Get multiple items from cache."""
        if not identifiers:
            return {}

        keys = [self._key(id) for id in identifiers]
        values = await self.redis.mget(keys)

        result = {}
        for identifier, data in zip(identifiers, values):
            if data:
                self._hits += 1
                result[identifier] = self.model_class.model_validate_json(data)
            else:
                self._misses += 1
                result[identifier] = None

        return result

    async def set_many(
        self,
        items: dict[str, T],
        ttl: int | None = None,
    ) -> None:
        """Set multiple items in cache."""
        if not items:
            return

        pipe = self.redis.pipeline()
        for identifier, value in items.items():
            key = self._key(identifier)
            pipe.setex(key, ttl or self.default_ttl, value.model_dump_json())

        await pipe.execute()

    # -------------------------------------------------------------------------
    # Invalidation
    # -------------------------------------------------------------------------

    async def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all keys matching pattern.

        Args:
            pattern: Glob pattern (e.g., "user:*", "*:list:*")

        Returns:
            Number of keys deleted
        """
        full_pattern = self._key(pattern)
        keys = []

        async for key in self.redis.scan_iter(full_pattern):
            keys.append(key)

        if keys:
            return await self.redis.delete(*keys)
        return 0

    async def invalidate_all(self) -> int:
        """Invalidate all keys with this prefix."""
        return await self.invalidate_pattern("*")

    # -------------------------------------------------------------------------
    # Metrics
    # -------------------------------------------------------------------------

    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self._hits + self._misses
        return self._hits / total if total > 0 else 0.0

    def get_metrics(self) -> dict[str, Any]:
        """Get cache metrics."""
        return {
            "prefix": self.prefix,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": self.hit_rate,
        }

    def reset_metrics(self) -> None:
        """Reset metrics counters."""
        self._hits = 0
        self._misses = 0


# ============================================================================
# Decorator for Method Caching
# ============================================================================

def cached(
    prefix: str,
    ttl: int = 300,
    key_builder: Callable[..., str] | None = None,
):
    """
    Decorator for caching method results.

    Usage:
        @cached("analysis:stats", ttl=60)
        async def get_stats(self) -> Stats:
            ...
    """

    def decorator(func: Callable):
        from functools import wraps

        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            # Get Redis client from self
            redis_client = getattr(self, "redis", None)
            if not redis_client:
                return await func(self, *args, **kwargs)

            # Build cache key
            if key_builder:
                cache_key = f"{prefix}:{key_builder(*args, **kwargs)}"
            else:
                cache_key = f"{prefix}:{CacheService.hash_key(*args, **kwargs)}"

            # Try cache
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)

            # Execute and cache
            result = await func(self, *args, **kwargs)

            if result is not None:
                # Handle Pydantic models
                if hasattr(result, "model_dump_json"):
                    data = result.model_dump_json()
                else:
                    data = json.dumps(result)

                await redis_client.setex(cache_key, ttl, data)

            return result

        return wrapper

    return decorator


# ============================================================================
# Usage Example
# ============================================================================

if __name__ == "__main__":
    from pydantic import BaseModel

    class User(BaseModel):
        id: str
        name: str
        email: str

    async def main():
        # Initialize
        redis_client = redis.from_url("redis://localhost:6379")
        cache = CacheService(
            redis_client,
            prefix="user",
            model_class=User,
            default_ttl=300,
        )

        # Cache-aside pattern
        user = await cache.get_or_set(
            "123",
            fetch_fn=lambda: User(id="123", name="John", email="john@example.com"),
        )
        print(f"User: {user}")

        # Check metrics
        print(f"Hit rate: {cache.hit_rate:.2%}")

        # Batch operations
        users = {
            "1": User(id="1", name="Alice", email="alice@example.com"),
            "2": User(id="2", name="Bob", email="bob@example.com"),
        }
        await cache.set_many(users)

        # Get many
        retrieved = await cache.get_many(["1", "2", "3"])
        print(f"Retrieved: {retrieved}")

        # Invalidate
        deleted = await cache.invalidate_pattern("*")
        print(f"Deleted {deleted} keys")

        await redis_client.close()

    import asyncio
    asyncio.run(main())
