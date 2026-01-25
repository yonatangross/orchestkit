# Resource Management Patterns

Patterns for managing MCP resources with caching, lifecycle, and efficient URI handling.

## Resource Manager with TTL

```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Generic, TypeVar
from functools import lru_cache
import asyncio
import hashlib

T = TypeVar("T")

@dataclass
class CachedResource(Generic[T]):
    """Resource with metadata for cache management."""
    data: T
    created_at: datetime
    last_accessed: datetime
    access_count: int = 0
    size_bytes: int = 0

    def touch(self) -> None:
        """Update last access time and count."""
        self.last_accessed = datetime.now()
        self.access_count += 1


class MCPResourceManager:
    """Production-ready MCP resource manager with caching."""

    def __init__(
        self,
        cache_ttl: timedelta = timedelta(minutes=15),
        max_cache_size: int = 100,
        max_memory_bytes: int = 100 * 1024 * 1024,  # 100MB
    ):
        self.cache_ttl = cache_ttl
        self.max_cache_size = max_cache_size
        self.max_memory_bytes = max_memory_bytes
        self._cache: dict[str, CachedResource] = {}
        self._lock = asyncio.Lock()

    async def get(self, uri: str, loader: callable = None) -> Any:
        """Get resource with lazy loading and caching."""
        async with self._lock:
            # Check cache
            if uri in self._cache:
                resource = self._cache[uri]
                if not self._is_expired(resource):
                    resource.touch()
                    return resource.data
                else:
                    del self._cache[uri]

            # Load resource
            if loader is None:
                raise ValueError(f"Resource '{uri}' not cached and no loader provided")

            data = await loader(uri) if asyncio.iscoroutinefunction(loader) else loader(uri)

            # Cache it
            await self._cache_resource(uri, data)
            return data

    async def _cache_resource(self, uri: str, data: Any) -> None:
        """Cache resource with eviction if needed."""
        size = self._estimate_size(data)

        # Evict if needed
        while (
            len(self._cache) >= self.max_cache_size
            or self._total_size() + size > self.max_memory_bytes
        ):
            if not self._cache:
                break
            self._evict_lru()

        now = datetime.now()
        self._cache[uri] = CachedResource(
            data=data,
            created_at=now,
            last_accessed=now,
            size_bytes=size
        )

    def _is_expired(self, resource: CachedResource) -> bool:
        """Check if resource TTL has expired."""
        return datetime.now() - resource.created_at > self.cache_ttl

    def _evict_lru(self) -> None:
        """Evict least recently used resource."""
        if not self._cache:
            return
        lru_uri = min(
            self._cache.keys(),
            key=lambda k: self._cache[k].last_accessed
        )
        del self._cache[lru_uri]

    def _total_size(self) -> int:
        """Get total cached size in bytes."""
        return sum(r.size_bytes for r in self._cache.values())

    def _estimate_size(self, data: Any) -> int:
        """Estimate memory size of data."""
        import sys
        return sys.getsizeof(data)

    async def invalidate(self, uri: str) -> bool:
        """Invalidate a specific resource."""
        async with self._lock:
            if uri in self._cache:
                del self._cache[uri]
                return True
            return False

    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate resources matching pattern."""
        import re
        regex = re.compile(pattern)

        async with self._lock:
            to_remove = [
                uri for uri in self._cache
                if regex.match(uri)
            ]
            for uri in to_remove:
                del self._cache[uri]
            return len(to_remove)

    async def cleanup_expired(self) -> int:
        """Remove all expired resources."""
        async with self._lock:
            expired = [
                uri for uri, resource in self._cache.items()
                if self._is_expired(resource)
            ]
            for uri in expired:
                del self._cache[uri]
            return len(expired)

    def get_stats(self) -> dict:
        """Get cache statistics."""
        return {
            "size": len(self._cache),
            "max_size": self.max_cache_size,
            "memory_bytes": self._total_size(),
            "max_memory_bytes": self.max_memory_bytes,
            "ttl_seconds": self.cache_ttl.total_seconds(),
        }
```

## URI Pattern Registry

```python
from dataclasses import dataclass
from typing import Callable, Any
import re

@dataclass
class ResourcePattern:
    """Pattern for matching and loading resources."""
    pattern: str
    loader: Callable[[str, dict], Any]
    cache_ttl: timedelta | None = None

    def matches(self, uri: str) -> tuple[bool, dict]:
        """Check if URI matches pattern, extract params."""
        # Convert pattern like "user://{id}/profile" to regex
        regex_pattern = re.sub(r'\{(\w+)\}', r'(?P<\1>[^/]+)', self.pattern)
        match = re.fullmatch(regex_pattern, uri)
        if match:
            return True, match.groupdict()
        return False, {}


class URIRegistry:
    """Registry for URI patterns and their loaders."""

    def __init__(self):
        self._patterns: list[ResourcePattern] = []

    def register(
        self,
        pattern: str,
        loader: Callable,
        cache_ttl: timedelta | None = None
    ) -> None:
        """Register a URI pattern with its loader."""
        self._patterns.append(ResourcePattern(
            pattern=pattern,
            loader=loader,
            cache_ttl=cache_ttl
        ))

    def resolve(self, uri: str) -> tuple[Callable, dict, timedelta | None]:
        """Find matching pattern and extract parameters."""
        for pattern in self._patterns:
            matches, params = pattern.matches(uri)
            if matches:
                return pattern.loader, params, pattern.cache_ttl

        raise ValueError(f"No pattern matches URI: {uri}")


# Example usage
registry = URIRegistry()

async def load_user_profile(uri: str, params: dict) -> dict:
    user_id = params["id"]
    return {"id": user_id, "name": f"User {user_id}"}

registry.register(
    pattern="user://{id}/profile",
    loader=load_user_profile,
    cache_ttl=timedelta(minutes=5)
)
```

## Resource Lifecycle Events

```python
from enum import Enum
from dataclasses import dataclass
from typing import Callable, Any

class ResourceEvent(Enum):
    LOADED = "loaded"
    ACCESSED = "accessed"
    INVALIDATED = "invalidated"
    EXPIRED = "expired"
    EVICTED = "evicted"

@dataclass
class ResourceEventData:
    uri: str
    event: ResourceEvent
    data: Any | None = None
    metadata: dict | None = None


class ResourceEventEmitter:
    """Emit events for resource lifecycle changes."""

    def __init__(self):
        self._listeners: dict[ResourceEvent, list[Callable]] = {
            event: [] for event in ResourceEvent
        }

    def on(self, event: ResourceEvent, callback: Callable) -> None:
        """Register event listener."""
        self._listeners[event].append(callback)

    def emit(self, event: ResourceEvent, uri: str, **kwargs) -> None:
        """Emit event to all listeners."""
        event_data = ResourceEventData(uri=uri, event=event, **kwargs)
        for callback in self._listeners[event]:
            callback(event_data)


# Usage with resource manager
class ObservableResourceManager(MCPResourceManager):
    """Resource manager with event emission."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.events = ResourceEventEmitter()

    async def get(self, uri: str, loader: callable = None) -> Any:
        result = await super().get(uri, loader)
        self.events.emit(ResourceEvent.ACCESSED, uri)
        return result

    async def invalidate(self, uri: str) -> bool:
        result = await super().invalidate(uri)
        if result:
            self.events.emit(ResourceEvent.INVALIDATED, uri)
        return result
```

## Multi-Level Caching

```python
class MultiLevelResourceCache:
    """L1 (memory) -> L2 (Redis) -> L3 (origin) cache."""

    def __init__(
        self,
        redis_url: str,
        l1_ttl: timedelta = timedelta(minutes=1),
        l2_ttl: timedelta = timedelta(minutes=15),
    ):
        self.l1 = MCPResourceManager(cache_ttl=l1_ttl, max_cache_size=1000)
        self.l2_ttl = l2_ttl
        self.redis = Redis.from_url(redis_url)

    async def get(self, uri: str, loader: Callable) -> Any:
        """Get from L1, then L2, then origin."""
        # L1: In-memory
        try:
            return await self.l1.get(uri)
        except (KeyError, ValueError):
            pass

        # L2: Redis
        cached = self.redis.get(f"resource:{uri}")
        if cached:
            data = json.loads(cached)
            await self.l1._cache_resource(uri, data)
            return data

        # L3: Origin
        data = await loader(uri)

        # Populate caches
        self.redis.setex(
            f"resource:{uri}",
            int(self.l2_ttl.total_seconds()),
            json.dumps(data)
        )
        await self.l1._cache_resource(uri, data)

        return data
```

## Configuration

| Setting | Default | Recommendation |
|---------|---------|----------------|
| L1 TTL | 1 min | Short for freshness |
| L2 TTL | 15 min | Balance freshness/load |
| Max cache size | 100 | Based on memory budget |
| Max memory | 100MB | Tune per instance |
