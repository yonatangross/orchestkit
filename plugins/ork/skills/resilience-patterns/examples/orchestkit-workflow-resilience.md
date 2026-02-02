# OrchestKit Workflow Resilience Integration

This example shows how to wire resilience patterns into the OrchestKit analysis pipeline.

## Current Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    OrchestKit Analysis Pipeline                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Content ─▶ [Supervisor] ─▶ [Agent Fan-Out] ─▶ [Aggregate] ─▶ ... │
│                  │              │    │    │                         │
│                  ▼              ▼    ▼    ▼                         │
│              Agent Selection   A1   A2   A3   (Parallel Analysis)  │
│                                │    │    │                         │
│                                ▼    ▼    ▼                         │
│                              [findings, findings, findings]         │
│                                       │                             │
│                                       ▼                             │
│                              [Synthesize] ─▶ [Quality Gate]        │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Resilience Layer Integration

```
┌────────────────────────────────────────────────────────────────────┐
│                    With Resilience Patterns                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Content ─▶ [Rate Limiter] ─▶ [Circuit Breaker: LLM] ─▶ ...      │
│                                         │                           │
│                  ┌──────────────────────┼──────────────────────┐   │
│                  │                      ▼                      │   │
│                  │   ┌──────────────────────────────────────┐  │   │
│                  │   │         TIER 1: CRITICAL             │  │   │
│                  │   │  [Supervisor] [Synthesis] [QualityGate]│  │   │
│                  │   │   Bulkhead: 5 concurrent, 300s timeout │  │   │
│                  │   └──────────────────────────────────────┘  │   │
│                  │                                              │   │
│                  │   ┌──────────────────────────────────────┐  │   │
│                  │   │         TIER 2: STANDARD             │  │   │
│                  │   │  [Tech Comparator] [Impl Planner]     │  │   │
│                  │   │  [Security Auditor] [Learning Synth]  │  │   │
│                  │   │   Bulkhead: 3 concurrent, 120s timeout │  │   │
│                  │   └──────────────────────────────────────┘  │   │
│                  │                                              │   │
│                  │   ┌──────────────────────────────────────┐  │   │
│                  │   │         TIER 3: OPTIONAL             │  │   │
│                  │   │  [Enrichment] [Cache Warm]            │  │   │
│                  │   │   Bulkhead: 2 concurrent, 60s timeout  │  │   │
│                  │   └──────────────────────────────────────┘  │   │
│                  │                                              │   │
│                  └──────────────────────────────────────────────┘   │
│                                                                     │
│   Each agent call wrapped with:                                     │
│   @circuit_breaker(name="agent-{agent_type}")                      │
│   @bulkhead(tier=agent.tier)                                       │
│   @retry(max_attempts=2, base_delay=1.0)                           │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Circuit Breaker Registry

```python
# backend/app/shared/resilience/circuit_breakers.py

from app.core.circuit_breaker import CircuitBreaker

# Per-service circuit breakers
circuit_breakers = {
    # LLM APIs
    "openai": CircuitBreaker(
        name="openai",
        failure_threshold=3,
        recovery_timeout=60.0,
    ),
    "anthropic": CircuitBreaker(
        name="anthropic",
        failure_threshold=3,
        recovery_timeout=60.0,
    ),

    # External APIs
    "youtube": CircuitBreaker(
        name="youtube",
        failure_threshold=5,
        recovery_timeout=120.0,
    ),
    "arxiv": CircuitBreaker(
        name="arxiv",
        failure_threshold=5,
        recovery_timeout=60.0,
    ),
    "github": CircuitBreaker(
        name="github",
        failure_threshold=5,
        recovery_timeout=60.0,
    ),

    # Internal services
    "embedding": CircuitBreaker(
        name="embedding",
        failure_threshold=3,
        recovery_timeout=30.0,
    ),
    "database": CircuitBreaker(
        name="database",
        failure_threshold=2,
        recovery_timeout=15.0,
    ),
}

def get_circuit_breaker(service: str) -> CircuitBreaker:
    """Get or create circuit breaker for service."""
    if service not in circuit_breakers:
        circuit_breakers[service] = CircuitBreaker(
            name=service,
            failure_threshold=5,
            recovery_timeout=30.0,
        )
    return circuit_breakers[service]
```

### 2. Bulkhead Registry

```python
# backend/app/shared/resilience/bulkheads.py

from enum import Enum
from .bulkhead import Bulkhead, Tier, BulkheadRegistry

# Agent tier assignments
AGENT_TIERS = {
    # Tier 1: Critical
    "supervisor": Tier.CRITICAL,
    "synthesis": Tier.CRITICAL,
    "quality_gate": Tier.CRITICAL,

    # Tier 2: Standard
    "tech_comparator": Tier.STANDARD,
    "implementation_planner": Tier.STANDARD,
    "security_auditor": Tier.STANDARD,
    "learning_synthesizer": Tier.STANDARD,
    "codebase_analyzer": Tier.STANDARD,
    "prerequisite_mapper": Tier.STANDARD,
    "practical_applicator": Tier.STANDARD,
    "complexity_assessor": Tier.STANDARD,

    # Tier 3: Optional
    "enrichment": Tier.OPTIONAL,
    "cache_warm": Tier.OPTIONAL,
    "metrics": Tier.OPTIONAL,
}

# Create registry
bulkhead_registry = BulkheadRegistry()

# Register bulkheads for each tier
for agent_name, tier in AGENT_TIERS.items():
    bulkhead_registry.register(agent_name, tier)

def get_agent_bulkhead(agent_type: str) -> Bulkhead:
    """Get bulkhead for agent type."""
    tier = AGENT_TIERS.get(agent_type, Tier.STANDARD)
    return bulkhead_registry.get_or_create(agent_type, tier)
```

### 3. Resilient Agent Wrapper

```python
# backend/app/shared/resilience/agent_wrapper.py

from functools import wraps
from typing import TypeVar, Callable, Awaitable
import structlog

from .circuit_breakers import get_circuit_breaker
from .bulkheads import get_agent_bulkhead
from .retry_handler import retry, MaxRetriesExceededError

logger = structlog.get_logger()
T = TypeVar("T")

def resilient_agent(
    agent_type: str,
    llm_service: str = "anthropic",
    max_retries: int = 2,
):
    """
    Decorator to wrap agent execution with resilience patterns.

    Applies (in order):
    1. Circuit breaker for LLM service
    2. Bulkhead for concurrency control
    3. Retry for transient failures

    Example:
        @resilient_agent("tech_comparator", llm_service="anthropic")
        async def run_tech_comparator(content: str) -> AgentOutput:
            ...
    """
    def decorator(fn: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @wraps(fn)
        async def wrapper(*args, **kwargs) -> T:
            circuit = get_circuit_breaker(llm_service)
            bulkhead = get_agent_bulkhead(agent_type)

            # Track for observability
            logger.info(
                "agent_execution_start",
                agent_type=agent_type,
                circuit_state=circuit.state.value,
                bulkhead_active=bulkhead.stats.current_active,
            )

            async def execute():
                # Retry layer (innermost)
                @retry(max_attempts=max_retries, base_delay=1.0)
                async def with_retry():
                    return await fn(*args, **kwargs)

                return await with_retry()

            try:
                # Bulkhead layer
                async def with_bulkhead():
                    return await bulkhead.execute(execute)

                # Circuit breaker layer (outermost)
                result = await circuit.call(with_bulkhead)

                logger.info(
                    "agent_execution_success",
                    agent_type=agent_type,
                )

                return result

            except CircuitOpenError as e:
                logger.warning(
                    "agent_circuit_open",
                    agent_type=agent_type,
                    time_until_recovery=e.time_until_recovery,
                )
                raise

            except BulkheadFullError as e:
                logger.warning(
                    "agent_bulkhead_full",
                    agent_type=agent_type,
                    tier=e.tier.name,
                )
                raise

            except MaxRetriesExceededError as e:
                logger.error(
                    "agent_max_retries_exceeded",
                    agent_type=agent_type,
                    attempts=e.attempts,
                )
                raise

        return wrapper
    return decorator
```

### 4. Graph Builder Integration

```python
# backend/app/domains/analysis/workflows/graph_builder.py

from app.shared.resilience.agent_wrapper import resilient_agent
from app.shared.resilience.circuit_breakers import circuit_breakers

async def build_analysis_graph() -> StateGraph:
    """Build the analysis workflow graph with resilience."""

    # Wrap each agent node with resilience
    @resilient_agent("supervisor", llm_service="anthropic")
    async def supervisor_node(state: AnalysisState) -> AnalysisState:
        # Existing supervisor logic
        ...

    @resilient_agent("tech_comparator", llm_service="anthropic")
    async def tech_comparator_node(state: AnalysisState) -> AnalysisState:
        # Existing agent logic
        ...

    # Build graph with wrapped nodes
    graph = StateGraph(AnalysisState)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("tech_comparator", tech_comparator_node)
    # ... add other nodes

    # Add health check endpoint
    @app.get("/health/resilience")
    async def resilience_health():
        return {
            "circuit_breakers": {
                name: cb.get_status()
                for name, cb in circuit_breakers.items()
            },
            "bulkheads": bulkhead_registry.get_all_status(),
        }

    return graph.compile()
```

### 5. LLM Fallback Chain Integration

```python
# backend/app/shared/resilience/llm_chain.py

from app.shared.resilience.llm_fallback_chain import (
    LLMFallbackChain,
    LLMConfig,
)
from app.shared.services.cache.semantic_cache import SemanticCache

# Configure fallback chain for analysis
analysis_llm_chain = LLMFallbackChain(
    primary=AnthropicProvider(
        LLMConfig(
            name="primary",
            model="claude-sonnet-4-5-20251101",
            timeout=60.0,
            max_tokens=8192,
        )
    ),
    fallbacks=[
        OpenAIProvider(
            LLMConfig(
                name="fallback",
                model="gpt-5.2-mini",
                timeout=30.0,
                max_tokens=4096,
            )
        ),
    ],
    cache=SemanticCache(
        redis_client=redis_client,
        threshold=0.85,
    ),
    default_response=lambda p: json.dumps({
        "status": "degraded",
        "message": "Analysis temporarily unavailable",
        "partial_results": None,
    }),
)
```

### 6. Observability Integration

```python
# backend/app/shared/resilience/observability.py

from langfuse import Langfuse

langfuse = Langfuse()

def on_circuit_state_change(old_state: str, new_state: str, name: str):
    """Record circuit state changes in Langfuse."""
    langfuse.event(
        name="circuit_breaker_state_change",
        metadata={
            "circuit_name": name,
            "old_state": old_state,
            "new_state": new_state,
        },
        level="WARNING" if new_state == "open" else "INFO",
    )

def on_bulkhead_rejection(name: str, tier: str):
    """Record bulkhead rejections."""
    langfuse.event(
        name="bulkhead_rejection",
        metadata={
            "bulkhead_name": name,
            "tier": tier,
        },
        level="WARNING",
    )

# Wire up callbacks
for name, cb in circuit_breakers.items():
    cb._on_state_change = on_circuit_state_change

for name, bh in bulkhead_registry._bulkheads.items():
    bh._on_rejection = on_bulkhead_rejection
```

## Configuration

### Environment Variables

```bash
# Circuit Breaker
CIRCUIT_FAILURE_THRESHOLD=5
CIRCUIT_RECOVERY_TIMEOUT=30

# Bulkhead Tier 1
BULKHEAD_TIER1_CONCURRENT=5
BULKHEAD_TIER1_QUEUE=10
BULKHEAD_TIER1_TIMEOUT=300

# Bulkhead Tier 2
BULKHEAD_TIER2_CONCURRENT=3
BULKHEAD_TIER2_QUEUE=5
BULKHEAD_TIER2_TIMEOUT=120

# Bulkhead Tier 3
BULKHEAD_TIER3_CONCURRENT=2
BULKHEAD_TIER3_QUEUE=3
BULKHEAD_TIER3_TIMEOUT=60

# Retry
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY=1.0
RETRY_MAX_DELAY=30.0
```

### Monitoring Dashboard

```
┌────────────────────────────────────────────────────────────────────┐
│                   OrchestKit Resilience Dashboard                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   CIRCUIT BREAKERS                                                 │
│   ┌─────────────┬──────────┬────────────┬───────────────────┐     │
│   │ Service     │ State    │ Failures   │ Next Recovery     │     │
│   ├─────────────┼──────────┼────────────┼───────────────────┤     │
│   │ anthropic   │ ✅ CLOSED │ 0/5        │ -                 │     │
│   │ openai      │ ✅ CLOSED │ 1/5        │ -                 │     │
│   │ youtube     │ ⚠️ OPEN   │ 5/5        │ 45s               │     │
│   │ embedding   │ ✅ CLOSED │ 0/3        │ -                 │     │
│   └─────────────┴──────────┴────────────┴───────────────────┘     │
│                                                                     │
│   BULKHEADS                                                        │
│   ┌─────────────────┬────────┬─────────┬─────────┬──────────┐     │
│   │ Tier            │ Active │ Queued  │ Max     │ Rejected │     │
│   ├─────────────────┼────────┼─────────┼─────────┼──────────┤     │
│   │ 1: Critical     │ 3/5    │ 1/10    │ 5       │ 0        │     │
│   │ 2: Standard     │ 3/3 ⚠️ │ 4/5     │ 3       │ 12       │     │
│   │ 3: Optional     │ 1/2    │ 0/3     │ 2       │ 45       │     │
│   └─────────────────┴────────┴─────────┴─────────┴──────────┘     │
│                                                                     │
│   RETRY STATS (Last Hour)                                          │
│   • Total Attempts: 1,234                                          │
│   • Success Rate: 94.2%                                            │
│   • Retries Used: 187                                              │
│   • Max Retries Exceeded: 23                                       │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Testing Resilience

```python
# backend/tests/integration/test_resilience.py

import pytest
from unittest.mock import AsyncMock, patch

async def test_circuit_opens_after_failures():
    """Circuit should open after threshold failures."""
    breaker = get_circuit_breaker("test-service")

    # Simulate failures
    for _ in range(5):
        with pytest.raises(ConnectionError):
            await breaker.call(failing_function)

    # Next call should be rejected
    with pytest.raises(CircuitOpenError):
        await breaker.call(failing_function)

async def test_bulkhead_rejects_when_full():
    """Bulkhead should reject when queue is full."""
    bulkhead = Bulkhead("test", Tier.STANDARD, max_concurrent=1, queue_size=1)

    # Fill the bulkhead
    task1 = asyncio.create_task(bulkhead.execute(slow_function))
    task2 = asyncio.create_task(bulkhead.execute(slow_function))

    # Third should be rejected
    with pytest.raises(BulkheadFullError):
        await bulkhead.execute(slow_function)

async def test_fallback_chain_uses_fallback():
    """Chain should use fallback when primary fails."""
    chain = LLMFallbackChain(
        primary=FailingProvider(),
        fallbacks=[MockProvider()],
    )

    response = await chain.complete("test prompt")
    assert response.is_fallback
    assert response.source == ResponseSource.FALLBACK
```
