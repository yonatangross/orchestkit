"""
Retry Handler Template

Configurable retry decorator with:
- Exponential backoff with jitter
- Error classification
- Retry budget
- Observability hooks

Usage:
    @retry(max_attempts=3, base_delay=1.0)
    async def call_api():
        ...

    # Or with custom error classification
    @retry(
        max_attempts=3,
        retryable_check=lambda e: e.status_code in {429, 503},
    )
    async def call_api():
        ...
"""

import asyncio
import logging
import random
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from functools import wraps
from time import time
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class RetryStats:
    """Statistics for retry operations."""
    total_attempts: int = 0
    successful_attempts: int = 0
    failed_attempts: int = 0
    retries_used: int = 0
    total_delay_seconds: float = 0.0


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    exponential_base: float = 2.0
    jitter: bool = True
    jitter_factor: float = 0.5  # For equal jitter


class MaxRetriesExceededError(Exception):
    """Raised when all retry attempts are exhausted."""

    def __init__(self, attempts: int, last_error: Exception):
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(
            f"Max retries ({attempts}) exceeded. Last error: {last_error}"
        )


# Default retryable exceptions
DEFAULT_RETRYABLE_EXCEPTIONS: set[type[Exception]] = {
    ConnectionError,
    TimeoutError,
    ConnectionResetError,
    ConnectionRefusedError,
    BrokenPipeError,
}


def calculate_delay(
    attempt: int,
    base_delay: float,
    max_delay: float,
    exponential_base: float,
    jitter: bool,
    jitter_factor: float = 0.5,
) -> float:
    """
    Calculate delay with exponential backoff and optional jitter.

    Args:
        attempt: Current attempt number (1-based)
        base_delay: Base delay in seconds
        max_delay: Maximum delay cap
        exponential_base: Base for exponential growth
        jitter: Whether to add jitter
        jitter_factor: Jitter range (0.5 = ±50%)

    Returns:
        Delay in seconds
    """
    # Exponential backoff
    delay = min(base_delay * (exponential_base ** (attempt - 1)), max_delay)

    # Add jitter to prevent thundering herd
    if jitter:
        # Full jitter: random between 0 and calculated delay
        delay = random.uniform(0, delay)

    return delay


def is_retryable_default(error: Exception) -> bool:
    """Default check if an error is retryable."""
    # Check exception type
    if type(error) in DEFAULT_RETRYABLE_EXCEPTIONS:
        return True

    # Check HTTP status code if available
    if hasattr(error, "status_code"):
        return error.status_code in {408, 429, 500, 502, 503, 504}

    # Check error code for API errors
    if hasattr(error, "code"):
        retryable_codes = {
            "rate_limit_exceeded",
            "server_error",
            "timeout",
            "overloaded",
            "overloaded_error",
            "api_error",
        }
        return error.code in retryable_codes

    return False


class RetryHandler:
    """
    Configurable retry handler with exponential backoff.

    Example:
        handler = RetryHandler(max_attempts=3, base_delay=1.0)

        @handler
        async def call_api():
            ...

        # Or explicitly
        result = await handler.execute(call_api, arg1, arg2)
    """

    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
        retryable_exceptions: set[type[Exception]] | None = None,
        retryable_check: Callable[[Exception], bool] | None = None,
        on_retry: Callable[[int, Exception, float], None] | None = None,
        on_success: Callable[[int], None] | None = None,
        on_failure: Callable[[int, Exception], None] | None = None,
    ):
        self.config = RetryConfig(
            max_attempts=max_attempts,
            base_delay=base_delay,
            max_delay=max_delay,
            exponential_base=exponential_base,
            jitter=jitter,
        )

        self.retryable_exceptions = retryable_exceptions or DEFAULT_RETRYABLE_EXCEPTIONS
        self.retryable_check = retryable_check or is_retryable_default

        # Callbacks
        self._on_retry = on_retry
        self._on_success = on_success
        self._on_failure = on_failure

        # Stats
        self.stats = RetryStats()

    def __call__(self, fn: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        """Use as decorator."""

        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            return await self.execute(fn, *args, **kwargs)

        return wrapper

    async def execute(
        self,
        fn: Callable[..., Awaitable[T]],
        *args: Any,
        **kwargs: Any,
    ) -> T:
        """
        Execute function with retry logic.

        Args:
            fn: Async function to execute
            *args: Positional arguments
            **kwargs: Keyword arguments

        Returns:
            Result from fn

        Raises:
            MaxRetriesExceededError: If all attempts fail
            Exception: Original exception if non-retryable
        """
        last_error: Exception | None = None

        for attempt in range(1, self.config.max_attempts + 1):
            self.stats.total_attempts += 1

            try:
                result = await fn(*args, **kwargs)
                self.stats.successful_attempts += 1

                if self._on_success:
                    self._on_success(attempt)

                return result

            except Exception as e:
                last_error = e
                self.stats.failed_attempts += 1

                # Check if retryable
                if not self._is_retryable(e):
                    logger.error(
                        f"Non-retryable error on attempt {attempt}: {e}",
                        extra={"function": fn.__name__, "error_type": type(e).__name__},
                    )
                    raise

                # Check if more attempts available
                if attempt >= self.config.max_attempts:
                    if self._on_failure:
                        self._on_failure(attempt, e)
                    raise MaxRetriesExceededError(attempt, e)

                # Calculate delay
                delay = calculate_delay(
                    attempt=attempt,
                    base_delay=self.config.base_delay,
                    max_delay=self.config.max_delay,
                    exponential_base=self.config.exponential_base,
                    jitter=self.config.jitter,
                )

                self.stats.retries_used += 1
                self.stats.total_delay_seconds += delay

                logger.warning(
                    f"Retry {attempt}/{self.config.max_attempts} after {delay:.2f}s",
                    extra={
                        "function": fn.__name__,
                        "error_type": type(e).__name__,
                        "error_message": str(e),
                        "delay": delay,
                    },
                )

                if self._on_retry:
                    self._on_retry(attempt, e, delay)

                await asyncio.sleep(delay)

        # Should not reach here, but just in case
        raise MaxRetriesExceededError(self.config.max_attempts, last_error)  # type: ignore

    def _is_retryable(self, error: Exception) -> bool:
        """Check if error should be retried."""
        # Check exception type first
        if type(error) in self.retryable_exceptions:
            return True

        # Use custom check
        return self.retryable_check(error)

    def get_stats(self) -> dict:
        """Get retry statistics."""
        return {
            "total_attempts": self.stats.total_attempts,
            "successful_attempts": self.stats.successful_attempts,
            "failed_attempts": self.stats.failed_attempts,
            "retries_used": self.stats.retries_used,
            "total_delay_seconds": self.stats.total_delay_seconds,
            "success_rate": (
                self.stats.successful_attempts / self.stats.total_attempts
                if self.stats.total_attempts > 0
                else 0
            ),
        }


def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: set[type[Exception]] | None = None,
    retryable_check: Callable[[Exception], bool] | None = None,
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    """
    Decorator for retry with exponential backoff.

    Example:
        @retry(max_attempts=3, base_delay=1.0)
        async def call_api():
            ...

        @retry(
            max_attempts=5,
            retryable_exceptions={ConnectionError, TimeoutError},
        )
        async def call_external_service():
            ...
    """
    handler = RetryHandler(
        max_attempts=max_attempts,
        base_delay=base_delay,
        max_delay=max_delay,
        exponential_base=exponential_base,
        jitter=jitter,
        retryable_exceptions=retryable_exceptions,
        retryable_check=retryable_check,
    )
    return handler


class RetryBudget:
    """
    Limits total retries to prevent retry storms.

    Example:
        budget = RetryBudget(budget_per_second=10.0)

        if budget.can_retry():
            budget.use_retry()
            await retry_operation()
    """

    def __init__(
        self,
        budget_per_second: float = 10.0,
        min_budget: float = 1.0,
        max_budget: float = 100.0,
    ):
        self.budget_per_second = budget_per_second
        self.min_budget = min_budget
        self.max_budget = max_budget
        self._budget = max_budget
        self._last_update = time()
        self._lock = asyncio.Lock()

    async def can_retry(self) -> bool:
        """Check if retry budget allows another retry."""
        async with self._lock:
            self._replenish()
            return self._budget >= 1.0

    async def use_retry(self) -> bool:
        """Use one retry from budget. Returns False if empty."""
        async with self._lock:
            self._replenish()
            if self._budget >= 1.0:
                self._budget -= 1.0
                return True
            return False

    def _replenish(self) -> None:
        """Replenish budget based on time elapsed."""
        now = time()
        elapsed = now - self._last_update
        self._budget = min(
            self._budget + elapsed * self.budget_per_second,
            self.max_budget,
        )
        self._last_update = now

    def get_status(self) -> dict:
        """Get budget status."""
        return {
            "current_budget": self._budget,
            "budget_per_second": self.budget_per_second,
            "max_budget": self.max_budget,
        }


# Preset configurations for common use cases
class RetryPresets:
    """Preset retry configurations."""

    @staticmethod
    def aggressive() -> RetryHandler:
        """Aggressive retry for critical operations."""
        return RetryHandler(
            max_attempts=5,
            base_delay=0.5,
            max_delay=30.0,
            exponential_base=2.0,
            jitter=True,
        )

    @staticmethod
    def conservative() -> RetryHandler:
        """Conservative retry for rate-limited APIs."""
        return RetryHandler(
            max_attempts=3,
            base_delay=2.0,
            max_delay=120.0,
            exponential_base=3.0,
            jitter=True,
        )

    @staticmethod
    def fast_fail() -> RetryHandler:
        """Fast fail for user-facing operations."""
        return RetryHandler(
            max_attempts=2,
            base_delay=0.5,
            max_delay=2.0,
            exponential_base=2.0,
            jitter=True,
        )

    @staticmethod
    def llm_api() -> RetryHandler:
        """Optimized for LLM API calls."""
        return RetryHandler(
            max_attempts=3,
            base_delay=1.0,
            max_delay=60.0,
            exponential_base=2.0,
            jitter=True,
            retryable_check=lambda e: (
                getattr(e, "code", None) in {
                    "rate_limit_exceeded",
                    "server_error",
                    "overloaded",
                }
                or getattr(e, "status_code", None) in {429, 500, 502, 503}
            ),
        )


# Example usage
if __name__ == "__main__":
    import random

    async def unreliable_api(fail_rate: float = 0.7) -> str:
        """Simulated unreliable API."""
        if random.random() < fail_rate:
            error_type = random.choice([
                ConnectionError("Connection refused"),
                TimeoutError("Request timed out"),
            ])
            raise error_type
        return "Success!"

    async def main():
        handler = RetryHandler(
            max_attempts=5,
            base_delay=0.5,
            on_retry=lambda a, e, d: print(f"  Retrying after {d:.2f}s..."),
        )

        print("Testing retry handler:")
        for i in range(3):
            print(f"\nAttempt {i + 1}:")
            try:
                result = await handler.execute(unreliable_api, fail_rate=0.6)
                print(f"  Result: {result}")
            except MaxRetriesExceededError as e:
                print(f"  Failed: {e}")

        print(f"\nStats: {handler.get_stats()}")

    asyncio.run(main())
