# Advanced Embedding Patterns

## Late Chunking

**Problem**: Traditional chunking embeds each chunk independently, losing cross-chunk context.

**Solution**: Late chunking embeds the full document first, then creates chunk embeddings from the contextualized token representations.

```python
from transformers import AutoModel, AutoTokenizer
import torch

class LateChunker:
    """Late chunking: embed full doc, extract chunk vectors from token embeddings."""

    def __init__(self, model_name: str = "jinaai/jina-embeddings-v3"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name, trust_remote_code=True)

    def embed_with_late_chunking(
        self,
        document: str,
        chunk_boundaries: list[tuple[int, int]]
    ) -> list[list[float]]:
        """
        Embed document and extract chunk embeddings from token representations.

        Args:
            document: Full document text
            chunk_boundaries: List of (start_char, end_char) for each chunk

        Returns:
            List of embeddings, one per chunk
        """
        # Tokenize full document
        inputs = self.tokenizer(
            document,
            return_tensors="pt",
            return_offsets_mapping=True,
            max_length=8192,
            truncation=True
        )

        # Get contextualized token embeddings
        with torch.no_grad():
            outputs = self.model(**{k: v for k, v in inputs.items() if k != "offset_mapping"})
            token_embeddings = outputs.last_hidden_state[0]  # [seq_len, hidden_dim]

        # Map char boundaries to token indices
        offset_mapping = inputs["offset_mapping"][0].tolist()
        chunk_embeddings = []

        for start_char, end_char in chunk_boundaries:
            # Find token indices for this chunk
            token_start = None
            token_end = None

            for i, (tok_start, tok_end) in enumerate(offset_mapping):
                if tok_start <= start_char < tok_end and token_start is None:
                    token_start = i
                if tok_start < end_char <= tok_end:
                    token_end = i + 1

            if token_start is not None and token_end is not None:
                # Mean pool tokens in this chunk
                chunk_tokens = token_embeddings[token_start:token_end]
                chunk_emb = chunk_tokens.mean(dim=0).numpy().tolist()
                chunk_embeddings.append(chunk_emb)

        return chunk_embeddings


# Usage
chunker = LateChunker()

document = "Full document text here..."
# Define chunk boundaries (character offsets)
boundaries = [(0, 500), (450, 950), (900, 1400)]  # Overlapping chunks

embeddings = chunker.embed_with_late_chunking(document, boundaries)
```

**Benefits**:
- Each chunk embedding contains context from entire document
- Better for documents with cross-referencing content
- Reduces "orphan chunk" problem

**When to Use**:
- Legal documents with defined terms used throughout
- Technical docs with abbreviations defined once
- Narrative content with character/entity references

---

## Batch API with Rate Limiting

```python
import asyncio
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

client = AsyncOpenAI()

class BatchEmbedder:
    """Production batch embedder with rate limiting and retry."""

    def __init__(
        self,
        model: str = "text-embedding-3-small",
        batch_size: int = 100,
        max_concurrent: int = 5,
        requests_per_minute: int = 3000
    ):
        self.model = model
        self.batch_size = batch_size
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.rate_limiter = asyncio.Semaphore(requests_per_minute)
        self._request_times: list[float] = []

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=60)
    )
    async def _embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed a single batch with retry logic."""
        async with self.semaphore:
            await self._wait_for_rate_limit()

            response = await client.embeddings.create(
                model=self.model,
                input=texts
            )
            return [item.embedding for item in response.data]

    async def _wait_for_rate_limit(self):
        """Token bucket rate limiting."""
        now = asyncio.get_event_loop().time()
        # Remove requests older than 1 minute
        self._request_times = [t for t in self._request_times if now - t < 60]

        if len(self._request_times) >= 3000:  # RPM limit
            sleep_time = 60 - (now - self._request_times[0])
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

        self._request_times.append(now)

    async def embed_all(
        self,
        texts: list[str],
        show_progress: bool = True
    ) -> list[list[float]]:
        """Embed all texts with batching and progress."""
        batches = [
            texts[i:i + self.batch_size]
            for i in range(0, len(texts), self.batch_size)
        ]

        all_embeddings = []
        for i, batch in enumerate(batches):
            if show_progress:
                print(f"Batch {i+1}/{len(batches)}")

            embeddings = await self._embed_batch(batch)
            all_embeddings.extend(embeddings)

        return all_embeddings


# Usage
async def main():
    embedder = BatchEmbedder()
    texts = ["text1", "text2", ...]  # Thousands of texts
    embeddings = await embedder.embed_all(texts)
```

---

## Embedding Cache with Redis

```python
import hashlib
import json
import redis
from typing import Optional

class EmbeddingCache:
    """Cache embeddings to avoid re-computing unchanged content."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        prefix: str = "emb:",
        ttl_days: int = 30
    ):
        self.redis = redis.from_url(redis_url)
        self.prefix = prefix
        self.ttl = ttl_days * 86400

    def _key(self, text: str, model: str) -> str:
        """Generate cache key from text hash and model."""
        content_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
        return f"{self.prefix}{model}:{content_hash}"

    def get(self, text: str, model: str) -> Optional[list[float]]:
        """Retrieve cached embedding."""
        data = self.redis.get(self._key(text, model))
        if data:
            return json.loads(data)
        return None

    def set(self, text: str, model: str, embedding: list[float]):
        """Cache embedding with TTL."""
        self.redis.setex(
            self._key(text, model),
            self.ttl,
            json.dumps(embedding)
        )

    def get_or_embed(
        self,
        texts: list[str],
        embed_fn: callable,
        model: str
    ) -> list[list[float]]:
        """Get cached embeddings or compute missing ones."""
        results = [None] * len(texts)
        to_embed = []
        to_embed_indices = []

        # Check cache
        for i, text in enumerate(texts):
            cached = self.get(text, model)
            if cached:
                results[i] = cached
            else:
                to_embed.append(text)
                to_embed_indices.append(i)

        # Embed uncached
        if to_embed:
            new_embeddings = embed_fn(to_embed)
            for idx, emb, text in zip(to_embed_indices, new_embeddings, to_embed):
                results[idx] = emb
                self.set(text, model, emb)

        return results
```

---

## Matryoshka Embeddings (Dimension Reduction)

OpenAI's text-embedding-3 models support dimension truncation:

```python
from openai import OpenAI

client = OpenAI()

# Full dimensions (3072 for large)
full = client.embeddings.create(
    model="text-embedding-3-large",
    input="Your text"
).data[0].embedding  # 3072 dims

# Truncated (saves storage, still effective)
truncated = client.embeddings.create(
    model="text-embedding-3-large",
    input="Your text",
    dimensions=1024  # or 512, 256
).data[0].embedding  # 1024 dims

# Performance vs dimensions (approximate):
# 3072 dims: 100% quality, 100% storage
# 1024 dims: 98% quality, 33% storage
# 512 dims:  95% quality, 17% storage
# 256 dims:  90% quality, 8% storage
```

**When to use reduced dimensions**:
- Large document collections (millions+)
- Cost-sensitive deployments
- When 95% accuracy is acceptable

---

## Local Embeddings with Ollama

```python
import httpx

class OllamaEmbedder:
    """Local embeddings using Ollama."""

    def __init__(
        self,
        model: str = "nomic-embed-text",
        base_url: str = "http://localhost:11434"
    ):
        self.model = model
        self.base_url = base_url

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed texts locally (no API costs)."""
        embeddings = []
        for text in texts:
            response = httpx.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text}
            )
            embeddings.append(response.json()["embedding"])
        return embeddings

# Usage
embedder = OllamaEmbedder()
vectors = embedder.embed(["text1", "text2"])
```

**Models available in Ollama**:
- `nomic-embed-text`: 768 dims, good quality
- `mxbai-embed-large`: 1024 dims, higher quality
- `all-minilm`: 384 dims, fast

---

## Related Skills
- `hyde-retrieval` - Hypothetical document embeddings
- `contextual-retrieval` - Context-prepending for chunks
- `rag-retrieval` - Full RAG pipeline patterns