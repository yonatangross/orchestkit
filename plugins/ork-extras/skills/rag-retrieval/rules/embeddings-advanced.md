---
title: Implement production embedding pipelines with batching, caching, and cost optimization
impact: MEDIUM
impactDescription: "Production embedding pipelines need batching, caching, and cost optimization to be practical at scale"
tags: late-chunking, batch, cache, matryoshka, production
---

## Advanced Embedding Patterns

Production patterns for embedding at scale.

**Embedding Cache (Redis):**
```python
import hashlib
import json
import redis

class EmbeddingCache:
    def __init__(self, redis_client: redis.Redis, ttl: int = 86400):
        self.redis = redis_client
        self.ttl = ttl

    def _key(self, text: str, model: str) -> str:
        h = hashlib.md5(f"{model}:{text}".encode()).hexdigest()
        return f"emb:{h}"

    async def get_or_embed(self, text: str, model: str, embed_fn) -> list[float]:
        key = self._key(text, model)
        cached = self.redis.get(key)
        if cached:
            return json.loads(cached)
        embedding = await embed_fn(text)
        self.redis.setex(key, self.ttl, json.dumps(embedding))
        return embedding
```

**Batch Processing with Rate Limiting:**
```python
import asyncio

async def batch_embed(texts: list[str], embed_fn, batch_size: int = 100) -> list[list[float]]:
    """Embed texts in batches with rate limiting."""
    results = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        embeddings = await embed_fn(batch)
        results.extend(embeddings)
        if i + batch_size < len(texts):
            await asyncio.sleep(0.1)  # Rate limit courtesy
    return results
```

**Matryoshka Dimension Reduction:**
```python
# text-embedding-3 models support Matryoshka embeddings
# Truncate to fewer dimensions with minimal quality loss
response = client.embeddings.create(
    model="text-embedding-3-large",
    input="Your text",
    dimensions=1536  # Reduce from 3072 to 1536 (saves 50% storage)
)
```

**Incorrect — no caching or batching, wasteful API calls:**
```python
async def embed_texts(texts: list[str]) -> list[list[float]]:
    results = []
    for text in texts:  # One API call per text!
        embedding = await client.embeddings.create(
            model="text-embedding-3-large",
            input=text
        )
        results.append(embedding.data[0].embedding)
    return results
```

**Correct — cached batching with rate limiting:**
```python
async def batch_embed(texts: list[str], batch_size: int = 100) -> list[list[float]]:
    results = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        # Check cache first
        cached_keys = [cache.get(text) for text in batch]
        uncached = [t for t, c in zip(batch, cached_keys) if not c]

        if uncached:
            embeddings = await client.embeddings.create(
                model="text-embedding-3-large",
                input=uncached,
                dimensions=1536  # Matryoshka reduction
            )
            for text, emb in zip(uncached, embeddings.data):
                cache.set(text, emb.embedding)  # Cache for reuse

        results.extend([cached or cache.get(t) for t, cached in zip(batch, cached_keys)])
        await asyncio.sleep(0.1)  # Rate limiting
    return results
```

**Key rules:**
- Late Chunking: Embed full document, extract chunk vectors from contextualized tokens
- Cache aggressively — same text + model = same embedding, no need to recompute
- Batch size 100-500 per API call for optimal throughput
- Matryoshka: Truncate `text-embedding-3-large` from 3072 to 1536 dims with ~2% quality loss
- Rate limit: 0.1s delay between batches as courtesy to API providers
