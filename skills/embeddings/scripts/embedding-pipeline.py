"""
Embedding pipeline template for document processing.

Usage:
    from templates.embedding_pipeline import EmbeddingPipeline

    pipeline = EmbeddingPipeline()
    chunks = await pipeline.process_document(text, metadata)
"""

import asyncio
import hashlib
from collections.abc import Iterator
from dataclasses import dataclass

from openai import AsyncOpenAI


@dataclass
class Chunk:
    """Document chunk with embedding."""
    text: str
    embedding: list[float] | None = None
    metadata: dict | None = None
    token_count: int = 0
    content_hash: str = ""


class EmbeddingPipeline:
    """Production embedding pipeline with batching and caching."""

    def __init__(
        self,
        model: str = "text-embedding-3-small",
        chunk_size: int = 512,
        overlap: int = 50,
        batch_size: int = 100
    ):
        self.client = AsyncOpenAI()
        self.model = model
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.batch_size = batch_size
        self._cache: dict[str, list[float]] = {}

    async def process_document(
        self,
        text: str,
        metadata: dict | None = None
    ) -> list[Chunk]:
        """Chunk and embed a document."""
        chunks = list(self._chunk_text(text, metadata))
        await self._embed_batch(chunks)
        return chunks

    def _chunk_text(
        self,
        text: str,
        metadata: dict | None = None
    ) -> Iterator[Chunk]:
        """Split text into overlapping chunks."""
        words = text.split()
        step = self.chunk_size - self.overlap

        for i in range(0, len(words), step):
            chunk_words = words[i:i + self.chunk_size]
            chunk_text = " ".join(chunk_words)

            if not chunk_text.strip():
                continue

            yield Chunk(
                text=chunk_text,
                metadata=metadata,
                token_count=len(chunk_words),
                content_hash=self._hash(chunk_text)
            )

    async def _embed_batch(self, chunks: list[Chunk]):
        """Embed chunks in batches, using cache."""
        uncached = [c for c in chunks if c.content_hash not in self._cache]

        # Process in batches
        for i in range(0, len(uncached), self.batch_size):
            batch = uncached[i:i + self.batch_size]
            texts = [c.text for c in batch]

            response = await self.client.embeddings.create(
                model=self.model,
                input=texts
            )

            for chunk, data in zip(batch, response.data):
                chunk.embedding = data.embedding
                self._cache[chunk.content_hash] = data.embedding

        # Apply cached embeddings
        for chunk in chunks:
            if chunk.embedding is None:
                chunk.embedding = self._cache.get(chunk.content_hash)

    def _hash(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()[:16]

    def cosine_similarity(self, a: list[float], b: list[float]) -> float:
        """Calculate cosine similarity between vectors."""
        import math
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        return dot / (norm_a * norm_b)


# --- Example Usage ---

if __name__ == "__main__":

    async def main():
        pipeline = EmbeddingPipeline(chunk_size=256, overlap=25)

        document = """
        This is a sample document about embeddings.
        Embeddings convert text to dense vectors.
        These vectors capture semantic meaning.
        Similar texts have similar vectors.
        """

        chunks = await pipeline.process_document(
            text=document,
            metadata={"source": "example", "type": "tutorial"}
        )

        print(f"Created {len(chunks)} chunks")
        for i, chunk in enumerate(chunks):
            print(f"Chunk {i}: {chunk.token_count} tokens, dim={len(chunk.embedding)}")

        # Test similarity
        if len(chunks) >= 2:
            sim = pipeline.cosine_similarity(
                chunks[0].embedding,
                chunks[1].embedding
            )
            print(f"Similarity between chunk 0 and 1: {sim:.4f}")

    asyncio.run(main())