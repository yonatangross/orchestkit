"""
Bulkhead Pattern Template

Semaphore-based bulkhead implementation with:
- Tier-based resource isolation
- Configurable queue sizes and timeouts
- Rejection policies
- Metrics collection

Issue #588: Capacity sized for TRUE PARALLEL FAN-OUT within each tier.

Usage:
    bulkhead = Bulkhead(
        name="analysis-agents",
        tier=Tier.STANDARD,  # Uses tier defaults: max_concurrent=8, queue_size=12
    )

    result = await bulkhead.execute(agent.analyze, content)
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import Enum
from functools import wraps
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class Tier(Enum):
    """Bulkhead tiers for resource prioritization."""
    CRITICAL = 1   # Highest priority: synthesis, quality gate
    STANDARD = 2   # Normal priority: analysis agents
    OPTIONAL = 3   # Lowest priority: enrichment, caching


class RejectionPolicy(Enum):
    """Policy when bulkhead is full."""
    ABORT = "abort"        # Raise exception immediately
    CALLER_RUNS = "caller"  # Execute in caller's context (blocking)
    DISCARD = "discard"    # Silently drop, return None
    QUEUE = "queue"        # Wait in bounded queue (default)


@dataclass
class BulkheadStats:
    """Bulkhead statistics."""
    total_calls: int = 0
    successful_calls: int = 0
    rejected_calls: int = 0
    timed_out_calls: int = 0
    current_active: int = 0
    current_queued: int = 0
    max_active_seen: int = 0
    max_queued_seen: int = 0


class BulkheadFullError(Exception):
    """Raised when bulkhead queue is full."""

    def __init__(self, name: str, tier: Tier, queue_size: int):
        self.name = name
        self.tier = tier
        self.queue_size = queue_size
        super().__init__(
            f"Bulkhead '{name}' (tier={tier.name}) queue full ({queue_size} waiting)"
        )


class BulkheadTimeoutError(Exception):
    """Raised when bulkhead operation times out."""

    def __init__(self, name: str, timeout: float):
        self.name = name
        self.timeout = timeout
        super().__init__(f"Bulkhead '{name}' operation timed out after {timeout}s")


# Default tier configurations
# Issue #588: Capacity sized for TRUE PARALLEL FAN-OUT within each tier
# Tier 1: 4 agents → 5 workers (125% headroom), 180s timeout (fail fast)
# Tier 2: 8 agents → 8 workers (100% + 12 queue for burst)
# Tier 3: 4 agents → 4 workers (100% + 6 queue for burst)
TIER_DEFAULTS = {
    Tier.CRITICAL: {"max_concurrent": 5, "queue_size": 10, "timeout": 180.0},
    Tier.STANDARD: {"max_concurrent": 8, "queue_size": 12, "timeout": 120.0},
    Tier.OPTIONAL: {"max_concurrent": 4, "queue_size": 6, "timeout": 60.0},
}


class Bulkhead:
    """
    Semaphore-based bulkhead for resource isolation.

    Isolates operations by limiting concurrency, preventing one
    slow/failing component from exhausting all resources.

    Example:
        # Create bulkhead for analysis agents
        bulkhead = Bulkhead(
            name="analysis",
            tier=Tier.STANDARD,
        )

        # Use as decorator
        @bulkhead
        async def analyze(content):
            ...

        # Or explicitly
        result = await bulkhead.execute(analyze, content)
    """

    def __init__(
        self,
        name: str,
        tier: Tier = Tier.STANDARD,
        max_concurrent: int | None = None,
        queue_size: int | None = None,
        timeout: float | None = None,
        rejection_policy: RejectionPolicy = RejectionPolicy.QUEUE,
        on_rejection: Callable[[str, Tier], None] | None = None,
        on_timeout: Callable[[str, float], None] | None = None,
    ):
        self.name = name
        self.tier = tier

        # Get defaults for tier
        defaults = TIER_DEFAULTS[tier]
        self.max_concurrent: int = max_concurrent if max_concurrent is not None else int(defaults["max_concurrent"])
        self.queue_size: int = queue_size if queue_size is not None else int(defaults["queue_size"])
        self.timeout = timeout or defaults["timeout"]
        self.rejection_policy = rejection_policy

        # Callbacks
        self._on_rejection = on_rejection
        self._on_timeout = on_timeout

        # Semaphore for concurrency control
        self._semaphore = asyncio.Semaphore(self.max_concurrent)

        # Track queue depth
        self._waiting: int = 0
        self._active: int = 0
        self._lock = asyncio.Lock()

        # Stats
        self.stats = BulkheadStats()

    def __call__(self, fn: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        """Use as decorator."""

        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            return await self.execute(lambda: fn(*args, **kwargs))

        return wrapper

    async def execute(
        self,
        fn: Callable[[], Awaitable[T]],
        timeout: float | None = None,
    ) -> T:
        """
        Execute function within bulkhead constraints.

        Args:
            fn: Async function to execute (no args, use lambda if needed)
            timeout: Optional override for timeout

        Returns:
            Result from fn

        Raises:
            BulkheadFullError: If queue is full and policy is ABORT
            BulkheadTimeoutError: If operation times out
        """
        effective_timeout = timeout or self.timeout

        # Check queue capacity
        async with self._lock:
            if self._waiting >= self.queue_size:
                return await self._handle_rejection()

            self._waiting += 1
            self.stats.total_calls += 1
            self.stats.current_queued = self._waiting
            self.stats.max_queued_seen = max(
                self.stats.max_queued_seen, self._waiting
            )

        try:
            # Wait for semaphore with timeout
            try:
                await asyncio.wait_for(
                    self._semaphore.acquire(),
                    timeout=effective_timeout,
                )
            except TimeoutError:
                async with self._lock:
                    self._waiting -= 1
                    self.stats.current_queued = self._waiting
                return await self._handle_timeout(effective_timeout)

            # Got semaphore, update counters
            async with self._lock:
                self._waiting -= 1
                self._active += 1
                self.stats.current_queued = self._waiting
                self.stats.current_active = self._active
                self.stats.max_active_seen = max(
                    self.stats.max_active_seen, self._active
                )

            # Execute with timeout
            try:
                result = await asyncio.wait_for(fn(), timeout=effective_timeout)
                self.stats.successful_calls += 1
                return result
            except TimeoutError:
                return await self._handle_timeout(effective_timeout)
            finally:
                self._semaphore.release()
                async with self._lock:
                    self._active -= 1
                    self.stats.current_active = self._active

        except Exception:
            async with self._lock:
                if self._waiting > 0:
                    self._waiting -= 1
                    self.stats.current_queued = self._waiting
            raise

    async def _handle_rejection(self) -> T:  # type: ignore[return]
        """Handle queue full situation based on policy."""
        self.stats.rejected_calls += 1

        if self._on_rejection:
            self._on_rejection(self.name, self.tier)

        logger.warning(
            f"Bulkhead '{self.name}' (tier={self.tier.name}) rejecting request",
            extra={"queue_size": self.queue_size, "policy": self.rejection_policy.value},
        )

        if self.rejection_policy == RejectionPolicy.ABORT:
            raise BulkheadFullError(self.name, self.tier, self.queue_size)

        elif self.rejection_policy == RejectionPolicy.DISCARD:
            return None  # type: ignore

        elif self.rejection_policy == RejectionPolicy.CALLER_RUNS:
            # This is dangerous - blocks caller
            logger.warning(f"Bulkhead '{self.name}' executing in caller context")
            raise BulkheadFullError(self.name, self.tier, self.queue_size)

        else:  # QUEUE - but queue is full, so abort
            raise BulkheadFullError(self.name, self.tier, self.queue_size)

    async def _handle_timeout(self, timeout: float) -> T:  # type: ignore[return]
        """Handle timeout situation."""
        self.stats.timed_out_calls += 1

        if self._on_timeout:
            self._on_timeout(self.name, timeout)

        logger.warning(
            f"Bulkhead '{self.name}' operation timed out after {timeout}s"
        )

        raise BulkheadTimeoutError(self.name, timeout)

    def get_status(self) -> dict:
        """Get current bulkhead status."""
        return {
            "name": self.name,
            "tier": self.tier.name,
            "config": {
                "max_concurrent": self.max_concurrent,
                "queue_size": self.queue_size,
                "timeout": self.timeout,
                "rejection_policy": self.rejection_policy.value,
            },
            "current": {
                "active": self.stats.current_active,
                "queued": self.stats.current_queued,
                "utilization": self.stats.current_active / self.max_concurrent,
            },
            "stats": {
                "total_calls": self.stats.total_calls,
                "successful_calls": self.stats.successful_calls,
                "rejected_calls": self.stats.rejected_calls,
                "timed_out_calls": self.stats.timed_out_calls,
                "max_active_seen": self.stats.max_active_seen,
                "max_queued_seen": self.stats.max_queued_seen,
            },
        }


class BulkheadRegistry:
    """
    Registry for managing multiple bulkheads.

    Example:
        registry = BulkheadRegistry()

        # Register bulkheads
        registry.register("synthesis", Tier.CRITICAL)
        registry.register("analysis", Tier.STANDARD)
        registry.register("enrichment", Tier.OPTIONAL)

        # Get bulkhead for operation
        bulkhead = registry.get("synthesis")
        await bulkhead.execute(synthesize, findings)
    """

    def __init__(self):
        self._bulkheads: dict[str, Bulkhead] = {}

    def register(
        self,
        name: str,
        tier: Tier,
        **kwargs: Any,
    ) -> Bulkhead:
        """Register a new bulkhead."""
        if name in self._bulkheads:
            raise ValueError(f"Bulkhead '{name}' already registered")

        bulkhead = Bulkhead(name=name, tier=tier, **kwargs)
        self._bulkheads[name] = bulkhead
        return bulkhead

    def get(self, name: str) -> Bulkhead:
        """Get bulkhead by name."""
        if name not in self._bulkheads:
            raise KeyError(f"Bulkhead '{name}' not found")
        return self._bulkheads[name]

    def get_or_create(
        self,
        name: str,
        tier: Tier = Tier.STANDARD,
        **kwargs: Any,
    ) -> Bulkhead:
        """Get existing or create new bulkhead."""
        if name not in self._bulkheads:
            return self.register(name, tier, **kwargs)
        return self._bulkheads[name]

    def get_all_status(self) -> dict[str, dict]:
        """Get status of all bulkheads."""
        return {name: b.get_status() for name, b in self._bulkheads.items()}

    def get_tier_status(self, tier: Tier) -> dict[str, dict]:
        """Get status of bulkheads in a specific tier."""
        return {
            name: b.get_status()
            for name, b in self._bulkheads.items()
            if b.tier == tier
        }


# Global registry for convenience
_default_registry: BulkheadRegistry | None = None


def get_registry() -> BulkheadRegistry:
    """Get or create default bulkhead registry."""
    global _default_registry
    if _default_registry is None:
        _default_registry = BulkheadRegistry()
    return _default_registry


def bulkhead(
    name: str,
    tier: Tier = Tier.STANDARD,
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    """
    Decorator to wrap function with bulkhead.

    Example:
        @bulkhead("analysis", Tier.STANDARD)
        async def analyze(content):
            ...
    """
    def decorator(fn: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        b = get_registry().get_or_create(name, tier)

        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            return await b.execute(lambda: fn(*args, **kwargs))

        return wrapper

    return decorator


# Example usage
if __name__ == "__main__":
    import random

    async def slow_operation(name: str, delay: float) -> str:
        """Simulated slow operation."""
        await asyncio.sleep(delay)
        return f"{name} completed in {delay}s"

    async def main():
        # Create bulkhead
        registry = BulkheadRegistry()
        analysis_bulkhead = registry.register(
            "analysis",
            Tier.STANDARD,
            max_concurrent=2,
            queue_size=3,
            timeout=5.0,
        )

        # Simulate concurrent requests
        async def make_request(i: int):
            delay = random.uniform(0.5, 2.0)
            try:
                result = await analysis_bulkhead.execute(
                    lambda: slow_operation(f"req-{i}", delay)
                )
                print(f"Request {i}: {result}")
            except BulkheadFullError as e:
                print(f"Request {i}: REJECTED - {e}")
            except BulkheadTimeoutError as e:
                print(f"Request {i}: TIMEOUT - {e}")

        # Launch many concurrent requests
        tasks = [make_request(i) for i in range(10)]
        await asyncio.gather(*tasks, return_exceptions=True)

        # Print final status
        print("\nFinal Status:")
        print(analysis_bulkhead.get_status())

    asyncio.run(main())
