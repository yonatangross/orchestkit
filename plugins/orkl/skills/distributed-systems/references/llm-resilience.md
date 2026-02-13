# LLM-Specific Resilience Patterns

## Overview

LLM APIs have unique failure modes that require specialized resilience patterns. This guide covers fallback chains, token budget management, rate limiting, and cost optimization through resilience.

## Unique LLM Failure Modes

```
┌────────────────────────────────────────────────────────────┐
│                    LLM Failure Taxonomy                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   TRANSIENT (Retry)          PERMANENT (Fail Fast)         │
│   ─────────────────          ──────────────────────         │
│   • rate_limit_exceeded      • invalid_api_key             │
│   • model_overloaded         • content_policy_violation    │
│   • server_error             • invalid_request_error       │
│   • timeout                  • insufficient_quota          │
│   • context_length_exceeded* • model_not_found             │
│                                                             │
│   * Can retry with truncation                              │
│                                                             │
│   DEGRADABLE (Fallback)      COSTLY (Budget Control)       │
│   ─────────────────────      ────────────────────────       │
│   • Primary model down       • Large context = high cost   │
│   • Quality below threshold  • Streaming = token overhead  │
│   • Latency too high         • Retries multiply cost       │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## Pattern 1: Fallback Chain

```
┌────────────────────────────────────────────────────────────┐
│                    LLM Fallback Chain                       │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   Request ─▶ [Primary Model] ──success──▶ Response         │
│                    │                                        │
│                  fail (timeout, rate limit, error)          │
│                    ▼                                        │
│              [Fallback Model] ──success──▶ Response        │
│                    │                                        │
│                  fail                                       │
│                    ▼                                        │
│              [Semantic Cache] ──hit──▶ Response            │
│                    │                                        │
│                  miss                                       │
│                    ▼                                        │
│              [Default Response] ──▶ Graceful Degradation   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Implementation

```python
from dataclasses import dataclass
from typing import Optional, List, Callable, Awaitable

@dataclass
class LLMConfig:
    name: str
    model: str
    api_key: str
    timeout: float = 30.0
    max_tokens: int = 4096
    temperature: float = 0.7

class FallbackChain:
    def __init__(
        self,
        primary: LLMConfig,
        fallbacks: List[LLMConfig],
        cache: Optional[SemanticCache] = None,
        default_response: Optional[Callable[[str], str]] = None,
    ):
        self.primary = primary
        self.fallbacks = fallbacks
        self.cache = cache
        self.default_response = default_response

    async def complete(self, prompt: str, **kwargs) -> LLMResponse:
        # Try primary
        try:
            return await self._call_model(self.primary, prompt, **kwargs)
        except RetryableError as e:
            logger.warning(f"Primary model failed: {e}")

        # Try fallbacks
        for fallback in self.fallbacks:
            try:
                response = await self._call_model(fallback, prompt, **kwargs)
                response.is_fallback = True
                return response
            except RetryableError as e:
                logger.warning(f"Fallback {fallback.name} failed: {e}")

        # Try cache
        if self.cache:
            cached = await self.cache.get_similar(prompt, threshold=0.85)
            if cached:
                logger.info("Returning cached response")
                return LLMResponse(
                    content=cached.content,
                    is_cached=True,
                    cache_similarity=cached.similarity,
                )

        # Default response
        if self.default_response:
            return LLMResponse(
                content=self.default_response(prompt),
                is_degraded=True,
            )

        raise AllModelsFailedError("All LLM options exhausted")
```

### Recommended Fallback Configurations

| Use Case | Primary | Fallback 1 | Fallback 2 | Notes |
|----------|---------|------------|------------|-------|
| Analysis | Claude Sonnet | GPT-5.2-mini | Cache | Quality-first |
| Chat | GPT-5.2 | Claude Haiku | Default msg | Latency-first |
| Embedding | text-embedding-3-large | text-embedding-3-small | - | Dimension compat |
| Code Gen | Claude Sonnet | GPT-5.2 | - | Quality-first |

## Pattern 2: Token Budget Management

```
┌────────────────────────────────────────────────────────────┐
│                     Token Budget Guard                      │
├────────────────────────────────────────────────────────────┤
│                                                             │
│   Context Window: 128K tokens                              │
│   ┌────────────────────────────────────────────────────┐   │
│   │████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │
│   └────────────────────────────────────────────────────┘   │
│   Used: 32K (25%)         Available: 96K                   │
│                                                             │
│   Budget Allocation:                                        │
│   ├── System prompt:     2K  (fixed)                       │
│   ├── Conversation:     20K  (sliding window)              │
│   ├── Retrieved docs:    8K  (chunked)                     │
│   ├── Output reserve:    2K  (for response)                │
│   └── Safety margin:     5K  (overflow buffer)             │
│                                                             │
│   When approaching limit:                                   │
│   1. Summarize conversation history (4:1 compression)      │
│   2. Reduce retrieved chunks                               │
│   3. Truncate oldest messages                              │
│   4. Fail with "context too large" error                   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### Implementation

```python
import tiktoken
from dataclasses import dataclass
from typing import List

@dataclass
class BudgetAllocation:
    system_prompt: int = 2000
    conversation: int = 20000
    retrieved_docs: int = 8000
    output_reserve: int = 2000
    safety_margin: int = 5000

    @property
    def total_budget(self) -> int:
        return (
            self.system_prompt +
            self.conversation +
            self.retrieved_docs +
            self.output_reserve +
            self.safety_margin
        )

class TokenBudgetGuard:
    def __init__(
        self,
        model: str,
        context_limit: int,
        allocation: BudgetAllocation = None,
    ):
        self.encoding = tiktoken.encoding_for_model(model)
        self.context_limit = context_limit
        self.allocation = allocation or BudgetAllocation()

    def count_tokens(self, text: str) -> int:
        return len(self.encoding.encode(text))

    def fit_to_budget(
        self,
        system_prompt: str,
        messages: List[dict],
        retrieved_docs: List[str],
    ) -> tuple[str, List[dict], List[str]]:
        """Fit content to token budget, compressing as needed."""

        # Count fixed costs
        system_tokens = self.count_tokens(system_prompt)
        if system_tokens > self.allocation.system_prompt:
            raise TokenBudgetError("System prompt exceeds budget")

        # Fit messages with sliding window
        fitted_messages = self._fit_messages(
            messages,
            self.allocation.conversation
        )

        # Fit retrieved docs
        fitted_docs = self._fit_docs(
            retrieved_docs,
            self.allocation.retrieved_docs
        )

        return system_prompt, fitted_messages, fitted_docs

    def _fit_messages(self, messages: List[dict], budget: int) -> List[dict]:
        """Keep most recent messages that fit in budget."""
        fitted = []
        used = 0

        # Always keep system message if present
        for msg in reversed(messages):
            tokens = self.count_tokens(msg["content"])
            if used + tokens <= budget:
                fitted.insert(0, msg)
                used += tokens
            elif msg["role"] == "system":
                # Summarize old messages
                summary = self._summarize_old_messages(messages[:-len(fitted)])
                fitted.insert(0, {"role": "system", "content": summary})
                break

        return fitted

    def _fit_docs(self, docs: List[str], budget: int) -> List[str]:
        """Keep highest-scoring docs that fit in budget."""
        fitted = []
        used = 0

        for doc in docs:  # Assume already sorted by relevance
            tokens = self.count_tokens(doc)
            if used + tokens <= budget:
                fitted.append(doc)
                used += tokens
            else:
                break

        return fitted
```

## Pattern 3: Rate Limit Management

```python
from asyncio import Semaphore, sleep
from collections import deque
from time import time

class RateLimiter:
    """Token bucket rate limiter for LLM APIs."""

    def __init__(
        self,
        requests_per_minute: int = 60,
        tokens_per_minute: int = 100000,
    ):
        self.rpm_limit = requests_per_minute
        self.tpm_limit = tokens_per_minute
        self.request_times = deque(maxlen=rpm_limit)
        self.token_counts = deque(maxlen=1000)
        self.semaphore = Semaphore(rpm_limit)

    async def acquire(self, estimated_tokens: int):
        """Wait until rate limit allows the request."""
        async with self.semaphore:
            now = time()

            # Check RPM
            while len(self.request_times) >= self.rpm_limit:
                oldest = self.request_times[0]
                wait_time = 60 - (now - oldest)
                if wait_time > 0:
                    await sleep(wait_time)
                    now = time()
                self.request_times.popleft()

            # Check TPM
            recent_tokens = sum(
                t for t, ts in self.token_counts
                if now - ts < 60
            )
            if recent_tokens + estimated_tokens > self.tpm_limit:
                wait_time = 60 - (now - self.token_counts[0][1])
                await sleep(wait_time)

            # Record this request
            self.request_times.append(now)

    def record_usage(self, actual_tokens: int):
        """Record actual token usage after request completes."""
        self.token_counts.append((actual_tokens, time()))
```

## Pattern 4: Cost Control Circuit Breaker

```python
class CostCircuitBreaker:
    """Opens when LLM costs exceed budget."""

    def __init__(
        self,
        hourly_budget: float = 10.0,  # $10/hour
        daily_budget: float = 100.0,   # $100/day
        alert_threshold: float = 0.8,  # Alert at 80%
    ):
        self.hourly_budget = hourly_budget
        self.daily_budget = daily_budget
        self.alert_threshold = alert_threshold
        self.hourly_spend = 0.0
        self.daily_spend = 0.0
        self.last_hour_reset = time()
        self.last_day_reset = time()

    def record_cost(self, input_tokens: int, output_tokens: int, model: str):
        """Record cost and check budget."""
        self._reset_if_needed()

        cost = self._calculate_cost(input_tokens, output_tokens, model)
        self.hourly_spend += cost
        self.daily_spend += cost

        # Alert at threshold
        if self.hourly_spend > self.hourly_budget * self.alert_threshold:
            logger.warning(
                f"Hourly LLM budget at {self.hourly_spend/self.hourly_budget:.0%}"
            )

        # Trip circuit at limit
        if self.hourly_spend >= self.hourly_budget:
            raise CostBudgetExceeded("Hourly LLM budget exceeded")

        if self.daily_spend >= self.daily_budget:
            raise CostBudgetExceeded("Daily LLM budget exceeded")

    def _calculate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float:
        """Calculate cost based on model pricing (Dec 2025)."""
        PRICING = {
            "claude-sonnet-4-5-20251101": {"input": 3.0, "output": 15.0},
            "gpt-5.2": {"input": 2.5, "output": 10.0},
            "gpt-5.2-mini": {"input": 0.15, "output": 0.60},
            "claude-haiku-4-5-20251101": {"input": 0.80, "output": 4.0},
        }

        prices = PRICING.get(model, {"input": 1.0, "output": 3.0})
        return (
            (input_tokens / 1_000_000) * prices["input"] +
            (output_tokens / 1_000_000) * prices["output"]
        )
```

## Pattern 5: Quality-Aware Fallback

```python
class QualityAwareFallback:
    """Falls back when response quality is below threshold."""

    def __init__(
        self,
        primary_chain: FallbackChain,
        quality_evaluator: Callable[[str, str], float],
        quality_threshold: float = 0.7,
        max_retries: int = 2,
    ):
        self.chain = primary_chain
        self.evaluate = quality_evaluator
        self.threshold = quality_threshold
        self.max_retries = max_retries

    async def complete(self, prompt: str, **kwargs) -> LLMResponse:
        for attempt in range(self.max_retries + 1):
            response = await self.chain.complete(prompt, **kwargs)

            # Evaluate quality
            quality_score = await self.evaluate(prompt, response.content)

            if quality_score >= self.threshold:
                response.quality_score = quality_score
                return response

            logger.warning(
                f"Response quality {quality_score:.2f} below threshold",
                attempt=attempt + 1,
            )

            # Try with different parameters on retry
            if attempt < self.max_retries:
                kwargs["temperature"] = max(0.3, kwargs.get("temperature", 0.7) - 0.2)

        # Return best effort with warning
        response.quality_warning = f"Below threshold: {quality_score:.2f}"
        return response
```

## Best Practices (2026)

1. **Always have a fallback**: Even a cached or default response is better than an error
2. **Monitor costs per-request**: Track token usage in traces (Langfuse)
3. **Use streaming for long responses**: Better UX and partial results on failure
4. **Cache aggressively**: Semantic cache with 0.85+ similarity saves 60-80% costs
5. **Set appropriate timeouts**: 30s for completion, 5s for embeddings
6. **Log all fallback events**: Critical for understanding system behavior

## OrchestKit Integration

```python
# Example integration for OrchestKit analysis pipeline

llm_chain = FallbackChain(
    primary=LLMConfig(
        name="primary",
        model="claude-sonnet-4-5-20251101",
        timeout=30.0,
    ),
    fallbacks=[
        LLMConfig(
            name="fallback",
            model="gpt-5.2-mini",
            timeout=20.0,
        ),
    ],
    cache=semantic_cache,  # Redis-backed
    default_response=lambda p: "Analysis temporarily unavailable",
)

budget_guard = TokenBudgetGuard(
    model="claude-sonnet-4-5-20251101",
    context_limit=200000,
    allocation=BudgetAllocation(
        system_prompt=3000,
        conversation=10000,
        retrieved_docs=15000,  # RAG context
        output_reserve=4000,
        safety_margin=5000,
    ),
)

rate_limiter = RateLimiter(
    requests_per_minute=50,  # Leave headroom
    tokens_per_minute=80000,
)
```
