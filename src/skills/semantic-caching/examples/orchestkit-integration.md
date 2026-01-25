# OrchestKit Integration Example

## Integrating LLM Caching into OrchestKit

This example shows how to integrate multi-level caching into OrchestKit's analysis workflow.

## Current Architecture (Before Caching)

```
User submits URL/content
    ↓
ContentAnalysisService
    ↓
8 LangGraph Agents (sequential)
    ↓ Each agent calls Claude Sonnet 4
8 × $0.108 = $0.864 per analysis
```

## New Architecture (With Caching)

```
User submits URL/content
    ↓
MultiLevelCacheManager
    ↓
L1: In-Memory (exact) → L2: Redis (semantic) → L3: Prompt Cache → L4: LLM
    ↓
$0.02 avg per analysis (97% savings!)
```

## Step 1: Add Dependencies

```bash
# backend/pyproject.toml
[tool.poetry.dependencies]
redis = "^5.0.0"
redisvl = "^0.1.0"
cachetools = "^5.3.0"
```

```bash
poetry install
```

## Step 2: Update Docker Compose

```yaml
# docker-compose.yml
services:
  redis:
    image: redis/redis-stack:latest
    container_name: orchestkit-redis-cache
    ports:
      - "6379:6379"      # Redis
      - "8001:8001"      # RedisInsight
    environment:
      - REDIS_ARGS=--save 60 1000 --appendonly yes
    volumes:
      - redis-cache-data:/data
    networks:
      - orchestkit-network

volumes:
  redis-cache-data:
```

## Step 3: Initialize Semantic Cache

```python
# backend/app/shared/services/cache/__init__.py
from .semantic_cache_service import SemanticCacheService
from .multi_level_cache import MultiLevelCacheManager

# Initialize on startup
semantic_cache = SemanticCacheService(
    redis_url=settings.REDIS_URL,
    similarity_threshold=0.92,
    ttl_seconds=86400  # 24 hours
)

cache_manager = MultiLevelCacheManager(
    semantic_cache=semantic_cache,
    llm_client=get_llm_client()
)
```

## Step 4: Modify Agent Execution

```python
# backend/app/workflows/nodes/agent_node.py
from app.shared.services.cache import cache_manager

async def execute_agent_with_cache(
    agent_type: str,
    content: str,
    state: AnalysisState
) -> dict:
    """Execute agent with multi-level caching."""

    # Check cache (L1 → L2 → L3/L4)
    cached_response = await cache_manager.get_response(
        query=content[:2000],  # Preview for cache key
        agent_type=agent_type,
        force_refresh=state.get("force_refresh", False)
    )

    if cached_response:
        logger.info(
            "agent_cache_hit",
            agent_type=agent_type,
            cache_layer=cached_response.get("cache_layer"),
            cost_saved_usd=0.108
        )
        return cached_response

    # Cache miss - execute agent
    response = await execute_agent_llm_call(agent_type, content)

    # Store in cache
    await cache_manager.store_response(
        query=content[:2000],
        agent_type=agent_type,
        response=response
    )

    return response
```

## Step 5: Warm Cache from Golden Dataset

```python
# backend/scripts/warm_cache_from_golden.py
async def warm_orchestkit_cache():
    """Warm cache with 98 golden analyses."""

    from app.db.repositories.analysis_repository import AnalysisRepository
    from app.shared.services.cache import semantic_cache

    repo = AnalysisRepository()

    # Get all golden dataset analyses
    analyses = await repo.get_all(limit=100)

    warmed = 0
    for analysis in analyses:
        for finding in analysis.findings:
            # Extract content + response
            content = analysis.content_preview
            response = json.loads(finding.output)

            # Generate embedding
            embedding = await embeddings_service.embed_text(content[:2000])

            # Store in cache
            await semantic_cache.set(
                content=content,
                embedding=embedding,
                response=response,
                agent_type=finding.agent_type,
                quality_score=finding.confidence_score
            )

            warmed += 1

    print(f"✅ Warmed cache with {warmed} entries from golden dataset")

# Run it
asyncio.run(warm_orchestkit_cache())
```

## Step 6: Add Cache Metrics Endpoint

```python
# backend/app/api/v1/cache.py
from fastapi import APIRouter
from app.shared.services.cache import cache_manager

router = APIRouter(prefix="/cache", tags=["cache"])

@router.get("/stats")
async def get_cache_stats():
    """Get cache performance statistics."""
    return await cache_manager.get_stats()

@router.get("/health")
async def cache_health_check():
    """Check cache health."""
    return {
        "redis_connected": await cache_manager.semantic_cache.client.ping(),
        "cache_size": await cache_manager.semantic_cache.get_size(),
        "avg_quality": await cache_manager.semantic_cache.get_avg_quality()
    }

@router.post("/warm")
async def warm_cache():
    """Warm cache from golden dataset (admin only)."""
    from scripts.warm_cache_from_golden import warm_orchestkit_cache
    count = await warm_orchestkit_cache()
    return {"warmed_entries": count}
```

## Step 7: Frontend Cache Indicator

```tsx
// frontend/src/features/analysis/components/CacheIndicator.tsx
interface CacheIndicatorProps {
  cacheLayer?: 'L1' | 'L2' | 'L3' | 'L4';
  costSaved?: number;
}

export function CacheIndicator({ cacheLayer, costSaved }: CacheIndicatorProps) {
  if (!cacheLayer || cacheLayer === 'L4') return null;

  const labels = {
    L1: { text: 'Exact Match', color: 'green', icon: '⚡' },
    L2: { text: 'Semantic Match', color: 'blue', icon: '🔍' },
    L3: { text: 'Prompt Cached', color: 'purple', icon: '💾' },
  };

  const label = labels[cacheLayer];

  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{label.icon}</span>
      <span className={`text-${label.color}-600`}>{label.text}</span>
      {costSaved && (
        <span className="text-gray-500">
          (${costSaved.toFixed(4)} saved)
        </span>
      )}
    </div>
  );
}
```

## Step 8: Monitor Cache Performance

```python
# Add to Prometheus metrics
from prometheus_client import Gauge

cache_hit_rate = Gauge(
    "orchestkit_cache_hit_rate",
    "Cache hit rate percentage",
    ["layer"]
)

async def update_cache_metrics():
    """Update Prometheus metrics every minute."""
    while True:
        stats = await cache_manager.get_stats()

        cache_hit_rate.labels(layer="L1").set(stats["l1_hit_rate"])
        cache_hit_rate.labels(layer="L2").set(stats["l2_hit_rate"])
        cache_hit_rate.labels(layer="combined").set(stats["combined_hit_rate"])

        await asyncio.sleep(60)
```

## Expected Results

### Before Caching

```
1,000 analyses/day × $0.864 = $864/day = $315,360/year
```

### After Caching (Conservative)

```
Breakdown:
- L1 hits (10%): 100 × $0.00 = $0
- L2 hits (30%): 300 × $0.00 = $0
- L3 hits (50%): 500 × $0.0324 = $16.20
- L4 calls (10%): 100 × $0.864 = $86.40

Daily: $102.60
Yearly: $37,449

SAVINGS: 88% ($277,911/year)
```

### After Cache Warming

With golden dataset pre-loaded:

```
Day 1 hit rate: 45% (vs 0% cold start)
Week 1 avg hit rate: 65%
Month 1 avg hit rate: 75%
```

## Monitoring Dashboard

Grafana panel for OrchestKit cache performance:

```promql
# Combined cache hit rate
sum(rate(cache_hits_total{job="orchestkit-backend"}[5m]))
/
(
  sum(rate(cache_hits_total{job="orchestkit-backend"}[5m])) +
  sum(rate(cache_misses_total{job="orchestkit-backend"}[5m]))
)

# Cost saved per hour
sum(rate(llm_cost_saved_usd_total{job="orchestkit-backend"}[1h])) * 3600
```

## Testing

```python
# backend/tests/integration/test_cache_integration.py
import pytest

@pytest.mark.asyncio
async def test_cache_warm_from_golden():
    """Test cache warming from golden dataset."""
    from scripts.warm_cache_from_golden import warm_orchestkit_cache

    count = await warm_orchestkit_cache()

    assert count >= 415  # 98 analyses × ~8 agents
    assert await semantic_cache.get_size() >= 415

@pytest.mark.asyncio
async def test_agent_cache_hit():
    """Test agent execution uses cache."""
    content = "Test article about React hooks..."
    agent_type = "implementation_planner"

    # First call: cache miss
    result1 = await execute_agent_with_cache(agent_type, content, {})
    assert result1.get("cache_hit") == False

    # Second call: cache hit (semantic match)
    similar_content = "Tutorial about React hooks..."
    result2 = await execute_agent_with_cache(agent_type, similar_content, {})
    assert result2.get("cache_hit") == True
    assert result2.get("cache_layer") in ["L1", "L2"]
```

## Deployment Checklist

- [ ] Redis Stack deployed and accessible
- [ ] RedisSearch index created
- [ ] Cache service initialized on startup
- [ ] Cache warming script executed
- [ ] Prometheus metrics exposed
- [ ] Grafana dashboard imported
- [ ] Frontend cache indicators added
- [ ] Integration tests passing
- [ ] Cost tracking verified
- [ ] Monitoring alerts configured

---

**Estimated Implementation Time:** 8-12 hours
**Expected ROI:** 85-95% cost reduction
**Payback Period:** < 1 week
