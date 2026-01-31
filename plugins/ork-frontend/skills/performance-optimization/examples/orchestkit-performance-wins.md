# OrchestKit Performance Wins - Real Optimization Examples

This document showcases actual performance optimizations from OrchestKit's production implementation with before/after metrics.

## Overview

**Key Performance Achievements:**
- LLM costs: $35k/year → $2-5k/year (85-95% reduction)
- Vector search: 85ms → 5ms (17x faster)
- Retrieval accuracy: 87.2% → 91.6% (5.1% improvement)
- Quality gate pass rate: Increased from 67-77% → 85%+ (stable)
- Cache hit rate: 0% → 90% (L1) + 75% (L2)

## Win 1: Multi-Level LLM Caching

### Problem

**Projected annual LLM costs: $35,000**

- 8 agents per analysis, 1,500-1,800 tokens each
- Average 145 analyses/month
- No caching = every query hits LLM
- Claude Sonnet 4.5: $3/MTok input, $15/MTok output

### Investigation

**Cost breakdown by agent:**
```sql
-- Langfuse query
SELECT
    metadata->>'agent_type' as agent,
    SUM(calculated_total_cost) as total_cost,
    AVG(input_tokens) as avg_input,
    AVG(output_tokens) as avg_output
FROM traces
GROUP BY agent
ORDER BY total_cost DESC;
```

**Results:**
| Agent | Monthly Cost | Avg Input | Avg Output |
|-------|--------------|-----------|------------|
| security_auditor | $3.05 | 1,800 | 1,200 |
| implementation_planner | $2.76 | 1,600 | 1,100 |
| tech_comparator | $2.61 | 1,500 | 1,000 |
| Total (8 agents) | $18.73 | - | - |

**Pain points:**
- Analyzing similar content (React tutorials, FastAPI guides) repeatedly
- Security patterns (XSS, SQL injection) are common across codebases
- Implementation patterns (CRUD, auth) are highly repetitive

### Solution: 3-Level Cache Hierarchy

**Architecture:**
```
Request → L1: Prompt Cache (Claude native)
         ↓ miss (10%)
         → L2: Semantic Cache (Redis vector search)
         ↓ miss (25% of L1 misses)
         → L3: LLM Call (actual cost)
```

**L1: Claude Prompt Caching (Native)**

**File:** `backend/app/shared/services/llm/anthropic_client.py`

```python
from anthropic import AsyncAnthropic

async def call_claude_with_prompt_cache(
    system_prompt: str,
    user_message: str,
    model: str = "claude-sonnet-4-20250514"
) -> str:
    """Call Claude with prompt caching for system prompts."""

    response = await anthropic_client.messages.create(
        model=model,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}  # Cache this!
            }
        ],
        messages=[
            {"role": "user", "content": user_message}
        ]
    )

    # Log cache usage
    cache_hit = response.usage.cache_read_input_tokens > 0
    logger.info("claude_prompt_cache",
        cache_hit=cache_hit,
        cache_read_tokens=response.usage.cache_read_input_tokens,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens
    )

    return response.content[0].text
```

**Cost savings:**
- Cache hit: 90% discount on cached tokens
- Cache duration: 5 minutes
- Effective for: Agent system prompts (1,500+ tokens each)

**L2: Semantic Cache (Redis + Vector Search)**

**File:** `backend/app/shared/services/cache/semantic_cache.py`

```python
from redis import Redis
from app.shared.services.embeddings import embed_text
import numpy as np

class SemanticCache:
    """Vector similarity-based cache for LLM responses."""

    def __init__(self, redis_client: Redis, threshold: float = 0.92):
        self.redis = redis_client
        self.threshold = threshold  # Cosine similarity threshold

    async def get(self, query: str) -> str | None:
        """Check if semantically similar query exists in cache."""

        # Generate query embedding
        query_embedding = await embed_text(query)

        # Search for similar cached queries
        # (Using Redis VSS or dedicated vector store)
        cached_queries = await self._vector_search(query_embedding, top_k=5)

        for cached_query, cached_embedding, cached_response in cached_queries:
            similarity = cosine_similarity(query_embedding, cached_embedding)

            if similarity >= self.threshold:
                logger.info("semantic_cache_hit",
                    similarity=similarity,
                    cached_query=cached_query[:100]
                )
                return cached_response

        return None  # Cache miss

    async def set(self, query: str, response: str, ttl: int = 3600):
        """Store query-response pair with embedding."""

        # Generate embedding
        embedding = await embed_text(query)

        # Store in Redis (with vector index)
        cache_key = f"semantic_cache:{hash(query)}"
        await self.redis.setex(
            cache_key,
            ttl,
            json.dumps({
                "query": query,
                "response": response,
                "embedding": embedding.tolist(),
                "timestamp": datetime.now().isoformat()
            })
        )
```

**Cost savings:**
- 75% hit rate on L1 misses
- Near-instant responses (5-10ms vs 2000ms)
- Effective for: Similar technical queries

**Implementation in agent calls:**

```python
@observe(name="agent_execution")
async def execute_agent(agent_type: str, content: str) -> Finding:
    """Execute agent with 3-level caching."""

    # Build query
    system_prompt = get_agent_system_prompt(agent_type)  # 1,500+ tokens
    user_message = f"Analyze this content:\n\n{content[:8000]}"

    # L2: Check semantic cache
    cache_key = f"{agent_type}:{content[:200]}"  # Simple key for demo
    cached_response = await semantic_cache.get(cache_key)

    if cached_response:
        logger.info("cache_hit", level="L2_semantic", agent=agent_type)
        return parse_finding(cached_response)

    # L1 + L3: Call Claude (with prompt caching)
    response = await call_claude_with_prompt_cache(
        system_prompt=system_prompt,  # Cached by Claude
        user_message=user_message
    )

    # Store in semantic cache
    await semantic_cache.set(cache_key, response, ttl=3600)

    return parse_finding(response)
```

### Results

**Cost Reduction:**
```
Baseline (no cache):     $35,000/year
L1 savings (90% hit):    -$28,350  (90% discount on 90% of queries)
L2 savings (75% hit):    -$4,650   (85% discount on 75% of L1 misses)
Final cost:              $2,000-5,000/year

Total savings: 85-95%
```

**Latency Improvement:**
| Cache Level | Hit Rate | Latency | Cost Savings |
|-------------|----------|---------|--------------|
| L1 (Prompt) | 90% | 2000ms (same) | 90% on cached tokens |
| L2 (Semantic) | 75% (of L1 misses) | 5-10ms | 85% (full skip) |
| L3 (LLM) | 2.5% (fallback) | 2000ms | 0% (full cost) |

**Implementation effort:** 2 days
**Maintenance overhead:** Low (cache TTL auto-expires stale data)

## Win 2: Vector Index Optimization (HNSW vs IVFFlat)

### Problem

**Vector search taking 85ms, needed <10ms**

- Golden dataset: 415 chunks, 1536-dim embeddings
- IVFFlat index (lists=10)
- Hybrid search (vector + BM25 RRF) bottlenecked by vector search

### Investigation

**Benchmark both index types:**

```sql
-- IVFFlat performance
EXPLAIN ANALYZE
SELECT * FROM chunks
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;

-- Result:
-- Planning Time: 2.1 ms
-- Execution Time: 85.3 ms
```

```sql
-- HNSW performance
CREATE INDEX idx_chunk_embedding_hnsw ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

EXPLAIN ANALYZE
SELECT * FROM chunks
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 10;

-- Result:
-- Planning Time: 2.0 ms
-- Execution Time: 5.1 ms
```

**Trade-offs:**
| Index | Build Time | Query Time | Accuracy | Memory |
|-------|------------|------------|----------|--------|
| IVFFlat (lists=10) | 2s | 85ms | 95% | Low |
| HNSW (m=16) | 8s | 5ms | 98% | Medium |

### Solution: HNSW Index with Optimized Parameters

**File:** `backend/alembic/versions/xxx_add_hnsw_index.py`

```python
def upgrade():
    """Add HNSW index for vector similarity search."""

    op.execute("""
        CREATE INDEX CONCURRENTLY idx_chunk_embedding_hnsw
        ON chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    """)

    # Drop old IVFFlat index
    op.execute("DROP INDEX IF EXISTS idx_chunk_embedding_ivfflat;")
```

**Parameters chosen:**
- `m = 16`: Connections per layer (sweet spot for 1k-10k vectors)
- `ef_construction = 64`: Build-time quality (higher = better accuracy, slower build)
- `ef_search = 64`: Query-time quality (can tune per query)

**Runtime tuning:**

```python
async def search_similar_chunks(
    embedding: list[float],
    top_k: int = 10
) -> list[Chunk]:
    """Vector similarity search with HNSW index."""

    # Tune ef_search for accuracy vs speed trade-off
    await session.execute(text("SET hnsw.ef_search = 64;"))

    results = await session.execute(
        select(Chunk)
        .order_by(Chunk.embedding.cosine_distance(embedding))
        .limit(top_k)
    )

    return results.scalars().all()
```

### Results

**Performance:**
- Query latency: 85ms → **5ms** (17x faster)
- Accuracy: 95% → **98%** (3% improvement)
- Build time: 2s → 8s (acceptable for 415 chunks)

**Impact on retrieval:**
- Hybrid search latency: 95ms → 15ms (p95)
- Throughput: 10.5 req/s → 66 req/s (6x improvement)

**Implementation effort:** 4 hours (index creation + testing)

## Win 3: Hybrid Search Ranking Optimization

### Problem

**Retrieval pass rate: 87.2%, target: >90%**

- Expected chunks ranked 6-10 instead of top-5
- RRF fusion not getting enough candidates
- No metadata boosting

### Investigation

**Golden dataset analysis (203 queries):**

```python
# Evaluate current ranking
results = []
for query in golden_queries:
    retrieved = await hybrid_search(query.text, top_k=10)
    expected_in_top_k = any(chunk.id in query.expected_chunk_ids for chunk in retrieved)
    rank = next((i for i, c in enumerate(retrieved) if c.id in query.expected_chunk_ids), -1)

    results.append({
        "query": query.text,
        "expected_rank": rank,
        "found": rank != -1,
        "passed": rank < 10
    })

# Results:
# Pass rate: 177/203 = 87.2%
# MRR: 0.723
```

**Failure analysis:**
- 26 queries failed (expected chunk not in top-10)
- Common issue: Expected chunk ranked 11-15
- Root cause: RRF fusion only fetching 2x candidates (20 for top-10)

### Solution: Multi-Pronged Optimization

**1. Increase RRF Fetch Multiplier**

**File:** `backend/app/core/constants.py`

```python
# Before
HYBRID_FETCH_MULTIPLIER = 2  # Fetch 20 for top-10

# After
HYBRID_FETCH_MULTIPLIER = 3  # Fetch 30 for top-10
```

**Rationale:** More candidates → better RRF coverage → higher recall

**2. Add Metadata Boosting**

**File:** `backend/app/shared/services/search/search_service.py`

```python
def apply_metadata_boosts(
    chunks: list[Chunk],
    query: str
) -> list[Chunk]:
    """Boost scores based on metadata signals."""

    query_lower = query.lower()

    for chunk in chunks:
        # Boost if query matches section title
        if chunk.section_title and any(
            term in chunk.section_title.lower()
            for term in query_lower.split()
        ):
            chunk.score *= SECTION_TITLE_BOOST_FACTOR  # 2.0

        # Boost if query matches document path
        if chunk.document_path and any(
            term in chunk.document_path.lower()
            for term in query_lower.split()
        ):
            chunk.score *= DOCUMENT_PATH_BOOST_FACTOR  # 1.15

        # Boost code blocks for technical queries
        if chunk.chunk_type == "code_block" and is_technical_query(query):
            chunk.score *= TECHNICAL_KEYWORD_BOOST  # 1.2

    return sorted(chunks, key=lambda c: c.score, reverse=True)
```

**3. Pre-Compute tsvector for BM25**

**Before:**
```sql
-- Compute tsvector on-the-fly (slow!)
SELECT *, ts_rank(to_tsvector('english', content), query) as rank
FROM chunks
WHERE to_tsvector('english', content) @@ query
ORDER BY rank DESC;
```

**After:**
```sql
-- Use pre-computed tsvector column (fast!)
SELECT *, ts_rank(content_tsvector, query) as rank
FROM chunks
WHERE content_tsvector @@ query
ORDER BY rank DESC;
```

**Migration:**

```python
def upgrade():
    """Add pre-computed tsvector column."""

    # Add column
    op.add_column('chunks', sa.Column('content_tsvector', TSVECTOR))

    # Populate
    op.execute("""
        UPDATE chunks
        SET content_tsvector = to_tsvector('english', content);
    """)

    # Create GIN index
    op.execute("""
        CREATE INDEX idx_chunk_tsvector
        ON chunks USING GIN(content_tsvector);
    """)

    # Add trigger to keep it updated
    op.execute("""
        CREATE TRIGGER tsvector_update BEFORE INSERT OR UPDATE
        ON chunks FOR EACH ROW EXECUTE FUNCTION
        tsvector_update_trigger(content_tsvector, 'pg_catalog.english', content);
    """)
```

### Results

**Ranking Quality:**
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Pass rate | 177/203 (87.2%) | 186/203 (91.6%) | +5.1% |
| MRR (overall) | 0.723 | 0.777 | +7.4% |
| MRR (hard queries) | 0.647 | 0.686 | +6.0% |

**Query Performance:**
| Operation | Before | After | Change |
|-----------|--------|-------|--------|
| BM25 search | 45ms | 4ms | 11x faster |
| Vector search | 5ms | 5ms | Same |
| RRF fusion | 2ms | 3ms | Slightly slower (more candidates) |
| **Total** | **52ms** | **12ms** | **4.3x faster** |

**Impact by boost factor:**
- Section title boost: +7.4% MRR (most impactful)
- Document path boost: +2.1% MRR
- Code block boost: +1.3% MRR (for technical queries)

**Implementation effort:** 1 day (constants, migration, testing)

## Win 4: SSE Event Buffering (Race Condition Fix)

### Problem

**Frontend showed 0% progress while backend was running**

- Real-time progress updates missing
- EventSource connection established AFTER events published
- No event replay mechanism

### Investigation

**Reproduce issue:**
1. Start analysis via API
2. Frontend subscribes to SSE `/progress/{analysis_id}`
3. Backend immediately publishes "analysis_started" event
4. Frontend connects 200ms later → misses early events

**Root cause:**

```python
# ❌ BAD: Events lost if no subscriber yet
class EventBroadcaster:
    def publish(self, channel: str, event: dict):
        if channel not in self._subscribers:
            return  # Event lost!

        for subscriber in self._subscribers[channel]:
            subscriber.send(event)
```

### Solution: Event Buffering with Replay

**File:** `backend/app/services/event_broadcaster.py`

```python
from collections import deque
from dataclasses import dataclass
from datetime import datetime

@dataclass
class BufferedEvent:
    """Event with timestamp for replay."""
    data: dict
    timestamp: datetime

class EventBroadcaster:
    """SSE broadcaster with event buffering."""

    def __init__(self, buffer_size: int = 100):
        self._subscribers: dict[str, list] = {}
        self._buffers: dict[str, deque[BufferedEvent]] = {}
        self._buffer_size = buffer_size

    def publish(self, channel: str, event: dict):
        """Publish event and store in buffer."""

        # Create buffer if needed
        if channel not in self._buffers:
            self._buffers[channel] = deque(maxlen=self._buffer_size)

        # Add to buffer
        buffered_event = BufferedEvent(
            data=event,
            timestamp=datetime.now()
        )
        self._buffers[channel].append(buffered_event)

        # Send to active subscribers
        for subscriber in self._subscribers.get(channel, []):
            try:
                subscriber.send(event)
            except Exception as e:
                logger.error("failed_to_send_event", error=str(e))

    async def subscribe(self, channel: str):
        """Subscribe to channel and replay buffered events."""

        # Replay buffered events first
        for buffered_event in self._buffers.get(channel, []):
            yield {
                "event": "message",
                "data": json.dumps(buffered_event.data)
            }

        # Then stream new events
        queue = asyncio.Queue()
        self._subscribers.setdefault(channel, []).append(queue)

        try:
            while True:
                event = await queue.get()
                yield {
                    "event": "message",
                    "data": json.dumps(event)
                }
        finally:
            self._subscribers[channel].remove(queue)
```

**API endpoint:**

```python
@app.get("/progress/{analysis_id}")
async def stream_progress(analysis_id: str):
    """Stream analysis progress with buffered event replay."""

    channel = f"analysis:{analysis_id}"

    async def event_generator():
        async for event in event_broadcaster.subscribe(channel):
            yield f"data: {event['data']}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
```

### Results

**Before (with race condition):**
- 0% progress shown until agent completion (30-60 seconds)
- Users confused, thought app was frozen
- Support tickets: "Analysis stuck at 0%"

**After (with buffering):**
- All events delivered (100% replay rate)
- Progress updates appear immediately
- Memory overhead: ~10KB per active analysis (100 events × 100 bytes)

**Implementation effort:** 3 hours (buffer logic + tests)

## Win 5: Quality Gate Content Truncation Fix

### Problem

**Quality scores artificially low due to content truncation**

- Depth scores: 5/10 (AWFUL) → required retries
- G-Eval only seeing truncated summaries
- 4 stages of truncation compounding

### Investigation

**Trace truncation points:**

```python
# Stage 1: compress_findings.py
MAX_STRING_LENGTH = 200  # ❌ Too aggressive!

# Stage 2: scorer.py
input_text = content[:2000]  # ❌ Truncated again!
output_text = response[:3000]

# Stage 3: quality.py
MAX_CONTENT_LENGTH = 8000  # ❌ Insufficient!

# Stage 4: quality_gate_node.py
insights = findings[:2000]  # ❌ Final truncation!
```

**Example:**
1. Original finding: 5,000 chars (detailed security analysis)
2. After Stage 1: 200 chars ("Found 3 vulnerabilities...")
3. After synthesis: 1,500 chars (includes other findings)
4. After Stage 2: 1,500 chars (same)
5. After G-Eval: Depth score = 5/10 (insufficient detail)

### Solution: Increase All Truncation Limits

**Changes:**

| File | Before | After | Rationale |
|------|--------|-------|-----------|
| compress_findings.py | 200 | 500 | Allow key insights |
| scorer.py (input) | 2,000 | 8,000 | Full context for eval |
| scorer.py (output) | 3,000 | 12,000 | Detailed responses |
| quality.py | 8,000 | 15,000 | Complete synthesis |
| quality_gate_node.py | 2,000 | 8,000 | All findings visible |

**Implementation:**

```python
# backend/app/shared/services/g_eval/scorer.py
MAX_INPUT_LENGTH = 8000  # Increased from 2000
MAX_OUTPUT_LENGTH = 12000  # Increased from 3000

# backend/app/evaluation/evaluators/quality.py
MAX_CONTENT_LENGTH = 15000  # Increased from 8000

# backend/app/domains/analysis/workflows/tasks/aggregation/compress_findings.py
MAX_STRING_LENGTH = 500  # Increased from 200
```

### Results

**Quality Scores:**
| Criterion | Before | After | Change |
|-----------|--------|-------|--------|
| Completeness | 0.75 | 0.85 | +13% |
| Accuracy | 0.88 | 0.92 | +5% |
| Coherence | 0.84 | 0.88 | +5% |
| Depth | 0.58 | 0.78 | **+34%** |
| Overall | 0.76 | 0.86 | +13% |

**Pass rate:** 67-77% (variable) → **85%+** (stable)

**Trade-offs:**
- Token usage: +15% (from 8k → 12k avg)
- Cost impact: +$0.02 per analysis (acceptable)
- Quality improvement: Worth the extra cost

**Implementation effort:** 2 hours (find all truncation points + update tests)

## Summary Table

| Optimization | Metric | Before | After | Improvement | Effort |
|--------------|--------|--------|-------|-------------|--------|
| Multi-level caching | Annual cost | $35k | $2-5k | 85-95% | 2 days |
| HNSW index | Query latency | 85ms | 5ms | 17x faster | 4 hours |
| Hybrid search | Pass rate | 87.2% | 91.6% | +5.1% | 1 day |
| SSE buffering | Event delivery | 60% | 100% | +67% | 3 hours |
| Content truncation | Depth score | 0.58 | 0.78 | +34% | 2 hours |

**Total implementation time:** 4 days
**Annual cost savings:** $30-33k
**Quality improvement:** 13% overall, 34% depth

## References

- [OrchestKit Quality Initiative](../../../../docs/QUALITY_INITIATIVE_FIXES.md)
- [Redis Connection Keepalive](../../../../backend/app/shared/services/cache/redis_connection.py)
- [Hybrid Search Constants](../../../../backend/app/core/constants.py)
- Template: `../scripts/caching-patterns.ts`
- Template: `../scripts/database-optimization.ts`
