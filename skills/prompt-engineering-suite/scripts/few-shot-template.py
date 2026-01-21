"""
Few-Shot Prompt Template

Production-ready few-shot implementation with:
- Dynamic example selection (semantic similarity)
- Example ordering strategies
- Caching for embeddings
- Langfuse observability

Usage:
    from templates.few_shot_template import FewShotPrompt, ExampleStore

    # Create example store
    store = ExampleStore(examples, embeddings_client)

    # Create few-shot prompt
    prompt = FewShotPrompt(
        system="Classify sentiment as positive, negative, or neutral.",
        store=store,
        n_examples=3
    )

    # Generate with dynamic examples
    result = await prompt.generate("I love this product!", llm_client)
"""

import asyncio
import hashlib
import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import numpy as np
from langfuse.decorators import langfuse_context, observe
from openai import AsyncOpenAI


# =============================================================================
# Configuration
# =============================================================================

DEFAULT_N_EXAMPLES = 3
EMBEDDING_MODEL = "text-embedding-3-small"
DEFAULT_MODEL = "gpt-4o"


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class Example:
    """A single few-shot example."""
    input: str
    output: str
    metadata: dict | None = None

    def to_dict(self) -> dict:
        return {"input": self.input, "output": self.output}

    def format(self, template: str = "Input: {input}\nOutput: {output}") -> str:
        return template.format(input=self.input, output=self.output)


# =============================================================================
# Example Store with Semantic Selection
# =============================================================================

class ExampleStore:
    """
    Store and retrieve examples with semantic similarity selection.

    Caches embeddings for efficient repeated lookups.
    """

    def __init__(
        self,
        examples: list[Example],
        client: AsyncOpenAI,
        embedding_model: str = EMBEDDING_MODEL
    ):
        self.examples = examples
        self.client = client
        self.embedding_model = embedding_model
        self._embeddings: list[list[float]] | None = None
        self._embedding_cache: dict[str, list[float]] = {}

    async def initialize(self) -> None:
        """Pre-compute embeddings for all examples."""
        if self._embeddings is not None:
            return

        texts = [ex.input for ex in self.examples]
        self._embeddings = await self._batch_embed(texts)

    async def _batch_embed(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple texts efficiently."""
        response = await self.client.embeddings.create(
            model=self.embedding_model,
            input=texts
        )
        return [item.embedding for item in response.data]

    async def _embed_single(self, text: str) -> list[float]:
        """Embed a single text with caching."""
        cache_key = hashlib.md5(text.encode()).hexdigest()

        if cache_key in self._embedding_cache:
            return self._embedding_cache[cache_key]

        response = await self.client.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        embedding = response.data[0].embedding
        self._embedding_cache[cache_key] = embedding
        return embedding

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        a_arr = np.array(a)
        b_arr = np.array(b)
        return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))

    async def select_similar(
        self,
        query: str,
        n: int = DEFAULT_N_EXAMPLES
    ) -> list[Example]:
        """Select n most similar examples to query."""
        await self.initialize()

        query_embedding = await self._embed_single(query)

        # Score all examples
        scores = [
            (self._cosine_similarity(query_embedding, emb), ex)
            for emb, ex in zip(self._embeddings, self.examples)
        ]

        # Sort by similarity (highest first)
        scores.sort(key=lambda x: x[0], reverse=True)

        return [ex for _, ex in scores[:n]]

    async def select_diverse(self, n: int = DEFAULT_N_EXAMPLES) -> list[Example]:
        """Select n diverse examples using max-margin selection."""
        await self.initialize()

        if n >= len(self.examples):
            return self.examples.copy()

        selected_indices = [0]  # Start with first example
        remaining = set(range(1, len(self.examples)))

        while len(selected_indices) < n and remaining:
            # Find example most different from already selected
            best_idx = None
            best_min_sim = float('inf')

            for idx in remaining:
                # Calculate minimum similarity to any selected example
                min_sim = min(
                    self._cosine_similarity(self._embeddings[idx], self._embeddings[sel])
                    for sel in selected_indices
                )
                if min_sim < best_min_sim:
                    best_min_sim = min_sim
                    best_idx = idx

            if best_idx is not None:
                selected_indices.append(best_idx)
                remaining.remove(best_idx)

        return [self.examples[i] for i in selected_indices]


# =============================================================================
# Few-Shot Prompt Builder
# =============================================================================

class FewShotPrompt:
    """
    Build and execute few-shot prompts with dynamic example selection.
    """

    def __init__(
        self,
        system: str,
        store: ExampleStore,
        n_examples: int = DEFAULT_N_EXAMPLES,
        example_format: str = "Input: {input}\nOutput: {output}",
        ordering: str = "similar_last"  # similar_last, similar_first, as_is
    ):
        self.system = system
        self.store = store
        self.n_examples = n_examples
        self.example_format = example_format
        self.ordering = ordering

    def _order_examples(
        self,
        examples: list[Example],
        query: str
    ) -> list[Example]:
        """Order examples based on strategy."""
        if self.ordering == "as_is":
            return examples

        # For similar_last, least similar first (most similar near the query)
        # For similar_first, reverse
        if self.ordering == "similar_last":
            return examples  # Already sorted most similar first, reverse for similar_last
        elif self.ordering == "similar_first":
            return list(reversed(examples))

        return examples

    def _build_messages(
        self,
        examples: list[Example],
        query: str
    ) -> list[dict]:
        """Build chat messages for the prompt."""
        messages = [{"role": "system", "content": self.system}]

        # Add examples as conversation turns
        for ex in examples:
            messages.append({"role": "user", "content": ex.input})
            messages.append({"role": "assistant", "content": ex.output})

        # Add the actual query
        messages.append({"role": "user", "content": query})

        return messages

    @observe(name="few_shot_generate")
    async def generate(
        self,
        query: str,
        client: AsyncOpenAI,
        model: str = DEFAULT_MODEL,
        selection: str = "similar"  # similar, diverse, fixed
    ) -> dict[str, Any]:
        """
        Generate response using few-shot prompting.

        Args:
            query: User input
            client: OpenAI client
            model: Model to use
            selection: Example selection strategy

        Returns:
            dict with response, examples used, and metadata
        """
        # Select examples
        if selection == "similar":
            examples = await self.store.select_similar(query, self.n_examples)
        elif selection == "diverse":
            examples = await self.store.select_diverse(self.n_examples)
        else:
            examples = self.store.examples[:self.n_examples]

        # Order examples
        ordered = self._order_examples(examples, query)

        # Build and send prompt
        messages = self._build_messages(ordered, query)

        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2
        )

        output = response.choices[0].message.content

        # Track in Langfuse
        langfuse_context.update_current_observation(
            metadata={
                "n_examples": len(examples),
                "selection_strategy": selection,
                "ordering": self.ordering,
                "example_inputs": [ex.input[:50] for ex in ordered]
            }
        )

        return {
            "output": output,
            "examples_used": [ex.to_dict() for ex in ordered],
            "model": model,
            "selection": selection
        }


# =============================================================================
# Static Few-Shot (No Embedding Required)
# =============================================================================

class StaticFewShotPrompt:
    """
    Simple few-shot prompt with fixed examples (no embedding).

    Use when examples are manually curated and don't need dynamic selection.
    """

    def __init__(
        self,
        system: str,
        examples: list[Example],
        example_format: str = "Input: {input}\nOutput: {output}"
    ):
        self.system = system
        self.examples = examples
        self.example_format = example_format

    def build_prompt(self, query: str) -> str:
        """Build a string prompt (for completion APIs)."""
        parts = [self.system, ""]

        for ex in self.examples:
            parts.append(ex.format(self.example_format))
            parts.append("")

        parts.append(f"Input: {query}")
        parts.append("Output:")

        return "\n".join(parts)

    def build_messages(self, query: str) -> list[dict]:
        """Build chat messages (for chat APIs)."""
        messages = [{"role": "system", "content": self.system}]

        for ex in self.examples:
            messages.append({"role": "user", "content": ex.input})
            messages.append({"role": "assistant", "content": ex.output})

        messages.append({"role": "user", "content": query})
        return messages

    @observe(name="static_few_shot")
    async def generate(
        self,
        query: str,
        client: AsyncOpenAI,
        model: str = DEFAULT_MODEL
    ) -> str:
        """Generate response using static few-shot."""
        messages = self.build_messages(query)

        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2
        )

        return response.choices[0].message.content


# =============================================================================
# Usage Example
# =============================================================================

if __name__ == "__main__":
    async def main():
        client = AsyncOpenAI()

        # Define examples
        examples = [
            Example("I love this product!", "positive"),
            Example("Worst purchase ever. Complete waste of money.", "negative"),
            Example("It's okay, nothing special.", "neutral"),
            Example("Absolutely amazing! Best thing I've bought.", "positive"),
            Example("Broken on arrival. Very disappointed.", "negative"),
        ]

        # Method 1: Static few-shot (no embeddings)
        print("=== Static Few-Shot ===")
        static_prompt = StaticFewShotPrompt(
            system="Classify the sentiment as positive, negative, or neutral.",
            examples=examples[:3]
        )
        result = await static_prompt.generate("This product exceeded my expectations!", client)
        print(f"Sentiment: {result}")

        # Method 2: Dynamic few-shot with semantic selection
        print("\n=== Dynamic Few-Shot ===")
        store = ExampleStore(examples, client)
        await store.initialize()

        dynamic_prompt = FewShotPrompt(
            system="Classify the sentiment as positive, negative, or neutral.",
            store=store,
            n_examples=3,
            ordering="similar_last"
        )

        result = await dynamic_prompt.generate(
            "Terrible experience, would not recommend.",
            client,
            selection="similar"
        )
        print(f"Sentiment: {result['output']}")
        print(f"Examples used: {[ex['input'][:30] for ex in result['examples_used']]}")

    asyncio.run(main())
