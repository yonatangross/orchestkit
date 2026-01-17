"""
Circuit Breaker Template

Production-ready circuit breaker implementation with:
- Sliding window failure tracking
- Configurable thresholds
- State change callbacks for observability
- Async-first design

Usage:
    breaker = CircuitBreaker(
        name="openai-api",
        failure_threshold=5,
        recovery_timeout=30.0,
    )

    result = await breaker.call(api_client.complete, prompt)
"""

import asyncio
import logging
from collections import deque
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from functools import wraps
from time import time
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation, counting failures
    OPEN = "open"          # Failing fast, rejecting requests
    HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class CircuitStats:
    """Circuit breaker statistics."""
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    rejected_calls: int = 0
    state_changes: int = 0
    last_failure_time: datetime | None = None
    last_success_time: datetime | None = None


@dataclass
class CircuitBreakerConfig:
    """Configuration for circuit breaker."""
    failure_threshold: int = 5          # Failures before opening
    success_threshold: int = 2          # Successes in half-open to close
    recovery_timeout: float = 30.0      # Seconds before half-open transition
    sliding_window_size: int = 10       # Requests to track
    slow_call_threshold: float = 10.0   # Seconds - calls slower count as failures
    slow_call_rate_threshold: float = 0.5  # Percentage of slow calls to trip


class CircuitOpenError(Exception):
    """Raised when circuit is open and request is rejected."""

    def __init__(self, name: str, time_until_recovery: float):
        self.name = name
        self.time_until_recovery = time_until_recovery
        super().__init__(
            f"Circuit '{name}' is open. Recovery in {time_until_recovery:.1f}s"
        )


class CircuitBreaker:
    """
    Async-first circuit breaker implementation.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: All requests rejected immediately
    - HALF_OPEN: Limited requests to test recovery

    Example:
        breaker = CircuitBreaker(name="my-service")

        @breaker
        async def call_service():
            ...

        # Or explicitly:
        result = await breaker.call(call_service, arg1, arg2)
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        recovery_timeout: float = 30.0,
        sliding_window_size: int = 10,
        slow_call_threshold: float = 10.0,
        on_state_change: Callable[[str, str, str], None] | None = None,
        on_failure: Callable[[Exception, str], None] | None = None,
    ):
        self.name = name
        self.config = CircuitBreakerConfig(
            failure_threshold=failure_threshold,
            success_threshold=success_threshold,
            recovery_timeout=recovery_timeout,
            sliding_window_size=sliding_window_size,
            slow_call_threshold=slow_call_threshold,
        )

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: float | None = None
        self._sliding_window: deque = deque(maxlen=sliding_window_size)

        # Callbacks
        self._on_state_change = on_state_change
        self._on_failure = on_failure

        # Stats
        self.stats = CircuitStats()

        # Lock for thread safety
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        """Current circuit state."""
        return self._state

    @property
    def is_open(self) -> bool:
        """Check if circuit is open (rejecting requests)."""
        return self._state == CircuitState.OPEN

    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed (normal operation)."""
        return self._state == CircuitState.CLOSED

    def __call__(self, fn: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        """Use as decorator."""

        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            return await self.call(fn, *args, **kwargs)

        return wrapper

    async def call(
        self,
        fn: Callable[..., Awaitable[T]],
        *args: Any,
        **kwargs: Any,
    ) -> T:
        """
        Execute function through circuit breaker.

        Args:
            fn: Async function to call
            *args: Positional arguments for fn
            **kwargs: Keyword arguments for fn

        Returns:
            Result from fn

        Raises:
            CircuitOpenError: If circuit is open
            Exception: Original exception if fn fails
        """
        async with self._lock:
            self._check_state_transition()

            if self._state == CircuitState.OPEN:
                time_until_recovery = self._time_until_recovery()
                self.stats.rejected_calls += 1
                raise CircuitOpenError(self.name, time_until_recovery)

        # Execute the call
        self.stats.total_calls += 1
        start_time = time()

        try:
            result = await fn(*args, **kwargs)
            duration = time() - start_time
            await self._on_success(duration)
            return result

        except Exception as e:
            duration = time() - start_time
            await self._on_call_failure(e, duration)
            raise

    async def _on_success(self, duration: float) -> None:
        """Handle successful call."""
        async with self._lock:
            self.stats.successful_calls += 1
            self.stats.last_success_time = datetime.now()

            # Track in sliding window
            is_slow = duration > self.config.slow_call_threshold
            self._sliding_window.append(("success", is_slow))

            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.config.success_threshold:
                    self._transition_to(CircuitState.CLOSED)

            elif self._state == CircuitState.CLOSED:
                # Check slow call rate
                if self._check_slow_call_rate():
                    self._transition_to(CircuitState.OPEN)

    async def _on_call_failure(self, error: Exception, duration: float) -> None:
        """Handle failed call."""
        async with self._lock:
            self.stats.failed_calls += 1
            self.stats.last_failure_time = datetime.now()
            self._last_failure_time = time()

            # Track in sliding window
            self._sliding_window.append(("failure", True))

            if self._on_failure:
                self._on_failure(error, self.name)

            if self._state == CircuitState.HALF_OPEN:
                # Single failure in half-open reopens circuit
                self._transition_to(CircuitState.OPEN)

            elif self._state == CircuitState.CLOSED:
                self._failure_count += 1
                if self._failure_count >= self.config.failure_threshold:
                    self._transition_to(CircuitState.OPEN)

    def _check_state_transition(self) -> None:
        """Check if state should transition based on time."""
        if self._state == CircuitState.OPEN:
            if self._should_attempt_recovery():
                self._transition_to(CircuitState.HALF_OPEN)

    def _should_attempt_recovery(self) -> bool:
        """Check if enough time has passed to attempt recovery."""
        if self._last_failure_time is None:
            return True
        elapsed = time() - self._last_failure_time
        return elapsed >= self.config.recovery_timeout

    def _time_until_recovery(self) -> float:
        """Calculate time until recovery attempt."""
        if self._last_failure_time is None:
            return 0.0
        elapsed = time() - self._last_failure_time
        return max(0.0, self.config.recovery_timeout - elapsed)

    def _check_slow_call_rate(self) -> bool:
        """Check if slow call rate exceeds threshold."""
        if len(self._sliding_window) < self.config.sliding_window_size:
            return False

        slow_count = sum(1 for _, is_slow in self._sliding_window if is_slow)
        slow_rate = slow_count / len(self._sliding_window)
        return slow_rate >= self.config.slow_call_rate_threshold

    def _transition_to(self, new_state: CircuitState) -> None:
        """Transition to a new state."""
        old_state = self._state
        self._state = new_state
        self.stats.state_changes += 1

        # Reset counters on state change
        if new_state == CircuitState.CLOSED:
            self._failure_count = 0
            self._success_count = 0
            self._sliding_window.clear()
        elif new_state == CircuitState.HALF_OPEN:
            self._success_count = 0

        logger.warning(
            f"Circuit '{self.name}' state change: {old_state.value} -> {new_state.value}"
        )

        if self._on_state_change:
            self._on_state_change(old_state.value, new_state.value, self.name)

    def reset(self) -> None:
        """Manually reset circuit to closed state."""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = None
        self._sliding_window.clear()
        logger.info(f"Circuit '{self.name}' manually reset")

    def get_status(self) -> dict:
        """Get current circuit status."""
        return {
            "name": self.name,
            "state": self._state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "time_until_recovery": (
                self._time_until_recovery()
                if self._state == CircuitState.OPEN
                else None
            ),
            "stats": {
                "total_calls": self.stats.total_calls,
                "successful_calls": self.stats.successful_calls,
                "failed_calls": self.stats.failed_calls,
                "rejected_calls": self.stats.rejected_calls,
                "state_changes": self.stats.state_changes,
            },
        }


# Factory for common configurations
class CircuitBreakerFactory:
    """Factory for creating circuit breakers with preset configurations."""

    @staticmethod
    def for_llm_api(name: str) -> CircuitBreaker:
        """Circuit breaker optimized for LLM APIs."""
        return CircuitBreaker(
            name=name,
            failure_threshold=3,        # LLM APIs can be unstable
            success_threshold=2,
            recovery_timeout=60.0,      # Give API time to recover
            slow_call_threshold=30.0,   # LLM calls can be slow
        )

    @staticmethod
    def for_external_api(name: str) -> CircuitBreaker:
        """Circuit breaker for external APIs (YouTube, GitHub, etc.)."""
        return CircuitBreaker(
            name=name,
            failure_threshold=5,
            success_threshold=2,
            recovery_timeout=30.0,
            slow_call_threshold=10.0,
        )

    @staticmethod
    def for_database(name: str) -> CircuitBreaker:
        """Circuit breaker for database operations."""
        return CircuitBreaker(
            name=name,
            failure_threshold=3,
            success_threshold=1,
            recovery_timeout=15.0,
            slow_call_threshold=5.0,
        )


# Example usage
if __name__ == "__main__":
    import random

    async def unreliable_service() -> str:
        """Simulated unreliable service."""
        if random.random() < 0.3:
            raise ConnectionError("Service unavailable")
        return "Success!"

    async def main():
        breaker = CircuitBreaker(
            name="test-service",
            failure_threshold=3,
            recovery_timeout=5.0,
        )

        for i in range(20):
            try:
                result = await breaker.call(unreliable_service)
                print(f"Call {i+1}: {result}")
            except CircuitOpenError as e:
                print(f"Call {i+1}: REJECTED - {e}")
            except ConnectionError as e:
                print(f"Call {i+1}: FAILED - {e}")

            await asyncio.sleep(0.5)

            # Print status periodically
            if (i + 1) % 5 == 0:
                print(f"Status: {breaker.get_status()}")

    asyncio.run(main())
