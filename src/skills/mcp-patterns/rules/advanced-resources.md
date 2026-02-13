---
title: Advanced Resources
impact: MEDIUM
impactDescription: "Without resource caching and lifecycle management, MCP servers leak memory and make redundant expensive calls"
tags: resources, caching, ttl, lru, lifecycle, memory-management
---

## Advanced Resources

Cache MCP resources with TTL and LRU eviction. Always track memory usage and clean up expired entries.

**Incorrect -- no caching, no cleanup:**
```python
@mcp.resource("user://{id}/profile")
async def get_profile(id: str) -> dict:
    return await db.query(f"SELECT * FROM users WHERE id = {id}")  # SQL injection + no cache
```

**Correct -- resource manager with TTL and LRU eviction:**
```python
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
import asyncio

@dataclass
class CachedResource:
    data: Any
    created_at: datetime
    last_accessed: datetime
    size_bytes: int = 0

    def touch(self) -> None:
        self.last_accessed = datetime.now()

class MCPResourceManager:
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

    async def get(self, uri: str, loader: callable) -> Any:
        async with self._lock:
            if uri in self._cache:
                resource = self._cache[uri]
                if datetime.now() - resource.created_at <= self.cache_ttl:
                    resource.touch()
                    return resource.data
                del self._cache[uri]  # Expired

            data = await loader(uri)
            await self._store(uri, data)
            return data

    async def _store(self, uri: str, data: Any) -> None:
        import sys
        size = sys.getsizeof(data)
        # Evict LRU entries if needed
        while (len(self._cache) >= self.max_cache_size
               or self._total_size() + size > self.max_memory_bytes):
            if not self._cache:
                break
            lru_uri = min(self._cache, key=lambda k: self._cache[k].last_accessed)
            del self._cache[lru_uri]

        now = datetime.now()
        self._cache[uri] = CachedResource(
            data=data, created_at=now, last_accessed=now, size_bytes=size,
        )

    def _total_size(self) -> int:
        return sum(r.size_bytes for r in self._cache.values())

    async def cleanup_expired(self) -> int:
        async with self._lock:
            now = datetime.now()
            expired = [
                uri for uri, r in self._cache.items()
                if now - r.created_at > self.cache_ttl
            ]
            for uri in expired:
                del self._cache[uri]
            return len(expired)
```

**Correct -- FastMCP lifespan with resource lifecycle:**
```python
from contextlib import asynccontextmanager
from mcp.server.fastmcp import FastMCP

@asynccontextmanager
async def app_lifespan(server: FastMCP):
    resources = MCPResourceManager(
        cache_ttl=timedelta(minutes=10),
        max_memory_bytes=50 * 1024 * 1024,
    )
    try:
        yield {"resources": resources}
    finally:
        await resources.cleanup_expired()  # Final cleanup

mcp = FastMCP("cached-server", lifespan=app_lifespan)
```

**Key rules:**
- Always set `max_cache_size` and `max_memory_bytes` caps
- Use `asyncio.Lock` for thread-safe cache access
- Run `cleanup_expired()` on shutdown and periodically
- Parameterize queries -- never interpolate user input into SQL
