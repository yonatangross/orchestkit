"""
LLM Fallback Chain Template

Multi-model fallback implementation with:
- Primary/fallback model chain
- Semantic cache integration
- Quality-aware fallback
- Cost tracking

Usage:
    chain = LLMFallbackChain(
        primary=LLMProvider("claude-sonnet-4-5-20251101"),
        fallbacks=[LLMProvider("gpt-5.2-mini")],
        cache=semantic_cache,
    )

    response = await chain.complete(prompt)
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class ResponseSource(Enum):
    """Source of the LLM response."""
    PRIMARY = "primary"
    FALLBACK = "fallback"
    CACHE = "cache"
    DEFAULT = "default"


@dataclass
class LLMResponse:
    """Response from LLM with metadata."""
    content: str
    source: ResponseSource
    model: str | None = None
    latency_ms: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    is_fallback: bool = False
    is_cached: bool = False
    is_degraded: bool = False
    cache_similarity: float | None = None
    quality_score: float | None = None
    quality_warning: str | None = None
    metadata: dict = field(default_factory=dict)


@dataclass
class LLMConfig:
    """Configuration for an LLM provider."""
    name: str
    model: str
    api_key: str | None = None
    timeout: float = 30.0
    max_tokens: int = 4096
    temperature: float = 0.7
    # Cost per 1M tokens (input, output)
    cost_per_million_input: float = 1.0
    cost_per_million_output: float = 3.0


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    def __init__(self, config: LLMConfig):
        self.config = config

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        **kwargs: Any,
    ) -> LLMResponse:
        """Generate completion for prompt."""
        pass

    def calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost for tokens."""
        input_cost = (input_tokens / 1_000_000) * self.config.cost_per_million_input
        output_cost = (output_tokens / 1_000_000) * self.config.cost_per_million_output
        return input_cost + output_cost


class SemanticCache(ABC):
    """Abstract base class for semantic cache."""

    @abstractmethod
    async def get_similar(
        self,
        prompt: str,
        threshold: float = 0.85,
    ) -> LLMResponse | None:
        """Get cached response if similar prompt exists."""
        pass

    @abstractmethod
    async def set(
        self,
        prompt: str,
        response: LLMResponse,
    ) -> None:
        """Cache a response."""
        pass


@dataclass
class FallbackChainStats:
    """Statistics for fallback chain."""
    total_calls: int = 0
    primary_successes: int = 0
    fallback_successes: int = 0
    cache_hits: int = 0
    default_responses: int = 0
    total_failures: int = 0
    total_cost_usd: float = 0.0
    total_latency_ms: float = 0.0


class LLMFallbackChain:
    """
    LLM fallback chain with graceful degradation.

    Tries models in order:
    1. Primary model
    2. Fallback models (in order)
    3. Semantic cache
    4. Default response

    Example:
        chain = LLMFallbackChain(
            primary=ClaudeProvider(config),
            fallbacks=[OpenAIProvider(fallback_config)],
            cache=RedisSemanticCache(),
            default_response=lambda p: "Analysis temporarily unavailable",
        )

        response = await chain.complete("Analyze this code...")
    """

    def __init__(
        self,
        primary: LLMProvider,
        fallbacks: list[LLMProvider] | None = None,
        cache: SemanticCache | None = None,
        cache_threshold: float = 0.85,
        default_response: Callable[[str], str] | None = None,
        on_fallback: Callable[[str, Exception], None] | None = None,
        on_cache_hit: Callable[[str, float], None] | None = None,
    ):
        self.primary = primary
        self.fallbacks = fallbacks or []
        self.cache = cache
        self.cache_threshold = cache_threshold
        self.default_response = default_response

        # Callbacks
        self._on_fallback = on_fallback
        self._on_cache_hit = on_cache_hit

        # Stats
        self.stats = FallbackChainStats()

    async def complete(
        self,
        prompt: str,
        use_cache: bool = True,
        cache_result: bool = True,
        **kwargs: Any,
    ) -> LLMResponse:
        """
        Generate completion with fallback chain.

        Args:
            prompt: The prompt to complete
            use_cache: Whether to check cache first
            cache_result: Whether to cache successful responses
            **kwargs: Additional arguments for LLM providers

        Returns:
            LLMResponse with content and metadata

        Raises:
            AllModelsFailedError: If all options exhausted and no default
        """
        import time

        self.stats.total_calls += 1
        start_time = time.time()

        # Try cache first (if enabled)
        if use_cache and self.cache:
            cached = await self.cache.get_similar(prompt, self.cache_threshold)
            if cached:
                self.stats.cache_hits += 1
                self.stats.total_latency_ms += (time.time() - start_time) * 1000

                if self._on_cache_hit:
                    self._on_cache_hit(prompt, cached.cache_similarity or 0)

                logger.info(
                    f"Cache hit (similarity={cached.cache_similarity:.2f})",
                    extra={"model": "cache"},
                )

                return LLMResponse(
                    content=cached.content,
                    source=ResponseSource.CACHE,
                    is_cached=True,
                    cache_similarity=cached.cache_similarity,
                    latency_ms=(time.time() - start_time) * 1000,
                )

        # Try primary model
        try:
            response = await self.primary.complete(prompt, **kwargs)
            response.source = ResponseSource.PRIMARY
            self.stats.primary_successes += 1
            self.stats.total_cost_usd += response.cost_usd
            self.stats.total_latency_ms += response.latency_ms

            # Cache successful response
            if cache_result and self.cache:
                await self.cache.set(prompt, response)

            return response

        except Exception as e:
            logger.warning(
                f"Primary model failed: {e}",
                extra={"model": self.primary.config.model},
            )

            if self._on_fallback:
                self._on_fallback(self.primary.config.model, e)

        # Try fallback models
        for fallback in self.fallbacks:
            try:
                response = await fallback.complete(prompt, **kwargs)
                response.source = ResponseSource.FALLBACK
                response.is_fallback = True
                self.stats.fallback_successes += 1
                self.stats.total_cost_usd += response.cost_usd
                self.stats.total_latency_ms += response.latency_ms

                logger.info(
                    f"Fallback successful: {fallback.config.model}",
                    extra={"model": fallback.config.model},
                )

                # Cache successful response
                if cache_result and self.cache:
                    await self.cache.set(prompt, response)

                return response

            except Exception as e:
                logger.warning(
                    f"Fallback model failed: {e}",
                    extra={"model": fallback.config.model},
                )

                if self._on_fallback:
                    self._on_fallback(fallback.config.model, e)

        # All models failed - try default response
        if self.default_response:
            self.stats.default_responses += 1
            self.stats.total_latency_ms += (time.time() - start_time) * 1000

            logger.warning("Using default response (all models failed)")

            return LLMResponse(
                content=self.default_response(prompt),
                source=ResponseSource.DEFAULT,
                is_degraded=True,
                latency_ms=(time.time() - start_time) * 1000,
            )

        # No fallback options left
        self.stats.total_failures += 1
        raise AllModelsFailedError("All LLM options exhausted")

    def get_stats(self) -> dict:
        """Get chain statistics."""
        return {
            "total_calls": self.stats.total_calls,
            "primary_successes": self.stats.primary_successes,
            "fallback_successes": self.stats.fallback_successes,
            "cache_hits": self.stats.cache_hits,
            "default_responses": self.stats.default_responses,
            "total_failures": self.stats.total_failures,
            "total_cost_usd": round(self.stats.total_cost_usd, 4),
            "avg_latency_ms": (
                self.stats.total_latency_ms / self.stats.total_calls
                if self.stats.total_calls > 0
                else 0
            ),
            "cache_hit_rate": (
                self.stats.cache_hits / self.stats.total_calls
                if self.stats.total_calls > 0
                else 0
            ),
        }


class QualityAwareFallbackChain(LLMFallbackChain):
    """
    Fallback chain that also falls back on low quality responses.

    Example:
        chain = QualityAwareFallbackChain(
            primary=ClaudeProvider(config),
            fallbacks=[OpenAIProvider(config)],
            quality_evaluator=evaluate_response_quality,
            quality_threshold=0.7,
        )
    """

    def __init__(
        self,
        primary: LLMProvider,
        fallbacks: list[LLMProvider] | None = None,
        cache: SemanticCache | None = None,
        quality_evaluator: Callable[[str, str], Awaitable[float]] | None = None,
        quality_threshold: float = 0.7,
        max_quality_retries: int = 2,
        **kwargs: Any,
    ):
        super().__init__(primary, fallbacks, cache, **kwargs)
        self.quality_evaluator = quality_evaluator
        self.quality_threshold = quality_threshold
        self.max_quality_retries = max_quality_retries

    async def complete(  # type: ignore[override]
        self,
        prompt: str,
        use_cache: bool = True,
        cache_result: bool = True,
        **kwargs: Any,
    ) -> LLMResponse:
        """Complete with quality-aware fallback."""
        best_response: LLMResponse | None = None
        best_score: float = 0.0

        for attempt in range(self.max_quality_retries + 1):
            # Get response from chain
            response = await super().complete(prompt, use_cache=use_cache, cache_result=cache_result, **kwargs)

            # If no quality evaluator, return immediately
            if not self.quality_evaluator:
                return response

            # Evaluate quality
            quality_score = await self.quality_evaluator(prompt, response.content)
            response.quality_score = quality_score

            # Track best response
            if quality_score > best_score:
                best_response = response
                best_score = quality_score

            # Good enough - return
            if quality_score >= self.quality_threshold:
                return response

            # Not good enough - log and try again
            logger.warning(
                f"Response quality {quality_score:.2f} below threshold {self.quality_threshold}",
                extra={"attempt": attempt + 1},
            )

            # Adjust parameters for retry
            kwargs["temperature"] = max(0.3, kwargs.get("temperature", 0.7) - 0.15)

        # Return best effort with warning
        if best_response:
            best_response.quality_warning = (
                f"Below threshold: {best_score:.2f} < {self.quality_threshold}"
            )
            return best_response

        raise AllModelsFailedError("Quality threshold not met after all attempts")


class AllModelsFailedError(Exception):
    """Raised when all LLM models in the chain fail."""
    pass


# Example provider implementations
class MockLLMProvider(LLMProvider):
    """Mock provider for testing."""

    def __init__(
        self,
        config: LLMConfig,
        fail_rate: float = 0.0,
        latency_ms: float = 100.0,
    ):
        super().__init__(config)
        self.fail_rate = fail_rate
        self.latency_ms = latency_ms

    async def complete(self, prompt: str, **kwargs: Any) -> LLMResponse:
        import random

        # Simulate latency
        await asyncio.sleep(self.latency_ms / 1000)

        # Simulate failures
        if random.random() < self.fail_rate:
            raise ConnectionError(f"Mock failure for {self.config.model}")

        # Return mock response
        return LLMResponse(
            content=f"Mock response from {self.config.model}",
            source=ResponseSource.PRIMARY,
            model=self.config.model,
            latency_ms=self.latency_ms,
            input_tokens=len(prompt.split()) * 2,
            output_tokens=50,
            cost_usd=0.001,
        )


# Example usage
if __name__ == "__main__":
    async def main():
        # Create providers
        primary = MockLLMProvider(
            LLMConfig(
                name="primary",
                model="claude-sonnet-4-5-20251101",
                cost_per_million_input=3.0,
                cost_per_million_output=15.0,
            ),
            fail_rate=0.3,
        )

        fallback = MockLLMProvider(
            LLMConfig(
                name="fallback",
                model="gpt-5.2-mini",
                cost_per_million_input=0.15,
                cost_per_million_output=0.60,
            ),
            fail_rate=0.1,
        )

        # Create chain
        chain = LLMFallbackChain(
            primary=primary,
            fallbacks=[fallback],
            default_response=lambda p: "Service temporarily unavailable",
            on_fallback=lambda m, e: print(f"  Fallback triggered: {m} - {e}"),
        )

        # Test calls
        print("Testing fallback chain:")
        for i in range(10):
            response = await chain.complete(f"Test prompt {i}")
            print(f"  {i+1}. Source: {response.source.value}, "
                  f"Model: {response.model}, "
                  f"Degraded: {response.is_degraded}")

        print(f"\nStats: {chain.get_stats()}")

    asyncio.run(main())
