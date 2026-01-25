# Cache Strategies

Multi-level caching strategies for LLM applications.

## Four-Level Cache Hierarchy

```python
from functools import lru_cache
from redis import Redis
import hashlib

class MultiLevelCache:
    """L1 (LRU) -> L2 (Exact Redis) -> L3 (Semantic) -> L4 (LLM)"""

    def __init__(self, redis_url: str, semantic_threshold: float = 0.92):
        self.redis = Redis.from_url(redis_url)
        self.threshold = semantic_threshold
        self._l1_cache = {}  # In-memory LRU

    async def get(self, query: str, agent_type: str) -> tuple[str, dict | None]:
        """Try each cache level, return (level, result)."""
        key = self._hash(query)

        # L1: In-memory exact match (~1ms)
        if key in self._l1_cache:
            return ("L1", self._l1_cache[key])

        # L2: Redis exact match (~5ms)
        exact = self.redis.get(f"exact:{agent_type}:{key}")
        if exact:
            result = json.loads(exact)
            self._l1_cache[key] = result  # Promote to L1
            return ("L2", result)

        # L3: Semantic similarity (~10ms)
        semantic = await self._semantic_lookup(query, agent_type)
        if semantic:
            self._l1_cache[key] = semantic  # Promote to L1
            return ("L3", semantic)

        return ("L4", None)  # Cache miss, call LLM

    async def set(self, query: str, result: dict, agent_type: str):
        """Store in all cache levels."""
        key = self._hash(query)
        self._l1_cache[key] = result
        self.redis.setex(f"exact:{agent_type}:{key}", 86400, json.dumps(result))
        await self._store_semantic(query, result, agent_type)

    def _hash(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()[:16]
```

## Similarity Threshold Tuning

| Threshold | Hit Rate | Accuracy | Use Case |
|-----------|----------|----------|----------|
| 0.98 | Low | Very High | Factual queries |
| 0.95 | Medium | High | General Q&A |
| 0.92 | High | Good | Code patterns (default) |
| 0.88 | Very High | Moderate | Similar intent only |

## Configuration

- L1 max size: 10,000 entries (LRU eviction)
- L2 TTL: 24 hours
- L3 embedding model: text-embedding-3-small
- Promote L2/L3 hits to L1 always

## Cost Optimization

- L1 hit: 100% cost savings, ~1ms latency
- L2 hit: 100% cost savings, ~5ms latency
- L3 hit: 100% LLM savings, ~10ms + embedding cost
- Track hit rates per level with Langfuse