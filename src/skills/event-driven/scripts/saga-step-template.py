"""
Saga Step Template (2026 Best Practices)

Idempotent saga step implementation with:
- Idempotency key management
- Retry with exponential backoff
- Timeout handling
- Structured logging
- Compensation support

Usage:
    step = IdempotentSagaStep(
        name="reserve_inventory",
        action=reserve_inventory,
        compensation=release_inventory,
        idempotency_store=redis_store,
    )
    result = await step.execute(saga_id, order_data)
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, TypeVar, ParamSpec
from uuid import UUID
import asyncio
import functools
import hashlib
import json
import structlog

logger = structlog.get_logger()

P = ParamSpec("P")
T = TypeVar("T")


@dataclass
class StepExecutionResult:
    """Result of step execution."""
    success: bool
    data: dict = field(default_factory=dict)
    error: str | None = None
    was_cached: bool = False
    execution_time_ms: float = 0.0
    retry_count: int = 0


class IdempotencyStore:
    """Protocol for idempotency storage."""

    async def get(self, key: str) -> dict | None:
        """Get cached result by idempotency key."""
        raise NotImplementedError

    async def set(self, key: str, value: dict, ttl: timedelta) -> None:
        """Store result with TTL."""
        raise NotImplementedError

    async def delete(self, key: str) -> None:
        """Delete cached result."""
        raise NotImplementedError


class RedisIdempotencyStore(IdempotencyStore):
    """Redis-backed idempotency store."""

    def __init__(self, redis_client):
        self.redis = redis_client

    async def get(self, key: str) -> dict | None:
        data = await self.redis.get(f"idem:{key}")
        return json.loads(data) if data else None

    async def set(self, key: str, value: dict, ttl: timedelta) -> None:
        await self.redis.setex(
            f"idem:{key}",
            int(ttl.total_seconds()),
            json.dumps(value, default=str),
        )

    async def delete(self, key: str) -> None:
        await self.redis.delete(f"idem:{key}")


def generate_idempotency_key(saga_id: UUID, step_name: str, params: dict | None = None) -> str:
    """Generate deterministic idempotency key."""
    content = f"{saga_id}:{step_name}"
    if params:
        # Exclude volatile fields from key generation
        stable_params = {k: v for k, v in params.items() if not k.startswith("_")}
        content += f":{json.dumps(stable_params, sort_keys=True, default=str)}"
    return hashlib.sha256(content.encode()).hexdigest()[:32]


class IdempotentSagaStep:
    """
    Idempotent saga step with retry and compensation support.

    Key Features:
    - Idempotency: Safe to retry without side effects
    - Retry: Exponential backoff on transient failures
    - Timeout: Per-step timeout handling
    - Logging: Structured logging for observability
    """

    def __init__(
        self,
        name: str,
        action: Callable[..., Any],
        compensation: Callable[..., Any],
        idempotency_store: IdempotencyStore | None = None,
        timeout_seconds: int = 60,
        max_retries: int = 3,
        retry_base_delay: float = 1.0,
        idempotency_ttl: timedelta = timedelta(days=7),
    ):
        self.name = name
        self.action = action
        self.compensation = compensation
        self.idempotency_store = idempotency_store
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.retry_base_delay = retry_base_delay
        self.idempotency_ttl = idempotency_ttl

    async def execute(
        self,
        saga_id: UUID,
        data: dict,
        **kwargs,
    ) -> StepExecutionResult:
        """
        Execute step with idempotency and retry support.

        Args:
            saga_id: Unique saga identifier
            data: Step input data
            **kwargs: Additional arguments for action

        Returns:
            StepExecutionResult with success status and data
        """
        idempotency_key = generate_idempotency_key(saga_id, self.name, data)
        start_time = datetime.now(timezone.utc)

        # Check idempotency cache
        if self.idempotency_store:
            cached = await self.idempotency_store.get(idempotency_key)
            if cached:
                logger.info(
                    "step_cache_hit",
                    step=self.name,
                    saga_id=str(saga_id),
                    cached_at=cached.get("executed_at"),
                )
                return StepExecutionResult(
                    success=True,
                    data=cached.get("result", {}),
                    was_cached=True,
                )

        # Execute with retry
        last_error: str | None = None
        retry_count = 0

        for attempt in range(self.max_retries + 1):
            try:
                logger.info(
                    "step_executing",
                    step=self.name,
                    saga_id=str(saga_id),
                    attempt=attempt + 1,
                )

                result = await asyncio.wait_for(
                    self.action(data, **kwargs),
                    timeout=self.timeout_seconds,
                )

                execution_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

                # Cache successful result
                if self.idempotency_store:
                    await self.idempotency_store.set(
                        idempotency_key,
                        {
                            "result": result or {},
                            "executed_at": datetime.now(timezone.utc).isoformat(),
                            "step": self.name,
                        },
                        self.idempotency_ttl,
                    )

                logger.info(
                    "step_completed",
                    step=self.name,
                    saga_id=str(saga_id),
                    execution_time_ms=execution_time,
                    retry_count=retry_count,
                )

                return StepExecutionResult(
                    success=True,
                    data=result or {},
                    execution_time_ms=execution_time,
                    retry_count=retry_count,
                )

            except asyncio.TimeoutError:
                last_error = f"Step timed out after {self.timeout_seconds}s"
                logger.warning(
                    "step_timeout",
                    step=self.name,
                    saga_id=str(saga_id),
                    attempt=attempt + 1,
                )

            except Exception as e:
                last_error = str(e)
                retry_count = attempt + 1

                if self._is_retryable_error(e) and attempt < self.max_retries:
                    delay = self._calculate_backoff(attempt)
                    logger.warning(
                        "step_retry",
                        step=self.name,
                        saga_id=str(saga_id),
                        attempt=attempt + 1,
                        delay_seconds=delay,
                        error=str(e),
                    )
                    await asyncio.sleep(delay)
                else:
                    break

        execution_time = (datetime.now(timezone.utc) - start_time).total_seconds() * 1000

        logger.error(
            "step_failed",
            step=self.name,
            saga_id=str(saga_id),
            error=last_error,
            retry_count=retry_count,
        )

        return StepExecutionResult(
            success=False,
            error=last_error,
            execution_time_ms=execution_time,
            retry_count=retry_count,
        )

    async def compensate_step(
        self,
        saga_id: UUID,
        data: dict,
        **kwargs,
    ) -> StepExecutionResult:
        """
        Execute compensation with idempotency.

        Compensation must be idempotent - safe to call multiple times.
        """
        compensation_key = f"comp:{generate_idempotency_key(saga_id, self.name, data)}"

        # Check if already compensated
        if self.idempotency_store:
            cached = await self.idempotency_store.get(compensation_key)
            if cached:
                logger.info(
                    "compensation_already_done",
                    step=self.name,
                    saga_id=str(saga_id),
                )
                return StepExecutionResult(success=True, was_cached=True)

        try:
            logger.info("step_compensating", step=self.name, saga_id=str(saga_id))

            await asyncio.wait_for(
                self.compensation(data, **kwargs),
                timeout=self.timeout_seconds,
            )

            # Cache compensation
            if self.idempotency_store:
                await self.idempotency_store.set(
                    compensation_key,
                    {"compensated_at": datetime.now(timezone.utc).isoformat()},
                    self.idempotency_ttl,
                )

            logger.info("step_compensated", step=self.name, saga_id=str(saga_id))
            return StepExecutionResult(success=True)

        except Exception as e:
            logger.error(
                "compensation_failed",
                step=self.name,
                saga_id=str(saga_id),
                error=str(e),
            )
            return StepExecutionResult(success=False, error=str(e))

    def _is_retryable_error(self, error: Exception) -> bool:
        """Determine if error is transient and retryable."""
        retryable_types = (
            ConnectionError,
            TimeoutError,
            asyncio.TimeoutError,
        )

        # Check for HTTP-like status codes in error message
        error_str = str(error).lower()
        retryable_codes = ("429", "500", "502", "503", "504")

        return (
            isinstance(error, retryable_types)
            or any(code in error_str for code in retryable_codes)
            or "temporary" in error_str
            or "retry" in error_str
        )

    def _calculate_backoff(self, attempt: int) -> float:
        """Calculate exponential backoff with jitter."""
        import random
        base_delay = self.retry_base_delay * (2 ** attempt)
        jitter = random.uniform(0, base_delay * 0.1)
        return min(base_delay + jitter, 60.0)  # Cap at 60 seconds


def idempotent_step(
    name: str,
    compensation: Callable[..., Any],
    idempotency_store: IdempotencyStore | None = None,
    timeout_seconds: int = 60,
    max_retries: int = 3,
):
    """
    Decorator to convert a function into an idempotent saga step.

    Usage:
        @idempotent_step(
            name="reserve_inventory",
            compensation=release_inventory,
            idempotency_store=redis_store,
        )
        async def reserve_inventory(data: dict) -> dict:
            ...
    """
    def decorator(func: Callable[P, T]) -> IdempotentSagaStep:
        step = IdempotentSagaStep(
            name=name,
            action=func,
            compensation=compensation,
            idempotency_store=idempotency_store,
            timeout_seconds=timeout_seconds,
            max_retries=max_retries,
        )
        return step
    return decorator


# Example usage - uncomment and modify for your use case:
#
# redis_store = RedisIdempotencyStore(redis_client)
#
# async def release_inventory(data: dict) -> None:
#     await inventory_service.release(data["reservation_id"])
#
# @idempotent_step(
#     name="reserve_inventory",
#     compensation=release_inventory,
#     idempotency_store=redis_store,
# )
# async def reserve_inventory(data: dict) -> dict:
#     result = await inventory_service.reserve(data["items"])
#     return {"reservation_id": result.id}
#
# # Execute:
# result = await reserve_inventory.execute(saga_id, order_data)
