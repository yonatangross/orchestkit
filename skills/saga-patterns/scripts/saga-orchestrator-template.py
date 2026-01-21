"""
Saga Orchestrator Template (2026 Best Practices)

Generic, production-ready saga orchestrator with:
- Persistent state management
- Idempotent step execution
- Automatic compensation on failure
- Outbox pattern integration
- Timeout handling
- Recovery support

Usage:
    orchestrator = SagaOrchestrator(db_session, event_publisher)
    saga = MySaga(order_data)
    result = await orchestrator.execute(saga)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Generic, TypeVar
from uuid import UUID, uuid4
import asyncio
import structlog

logger = structlog.get_logger()

# Type variable for saga data
T = TypeVar("T")


class SagaStatus(str, Enum):
    """Saga execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"
    FAILED = "failed"
    TIMED_OUT = "timed_out"


class StepStatus(str, Enum):
    """Individual step status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"
    SKIPPED = "skipped"


@dataclass
class StepResult:
    """Result of a saga step execution."""
    success: bool
    data: dict = field(default_factory=dict)
    error: str | None = None


@dataclass
class SagaStep:
    """Definition of a saga step with action and compensation."""
    name: str
    action: Callable[..., Any]
    compensation: Callable[..., Any]
    timeout_seconds: int = 60
    is_idempotent: bool = True
    status: StepStatus = StepStatus.PENDING
    result: StepResult | None = None
    executed_at: datetime | None = None
    compensated_at: datetime | None = None


@dataclass
class SagaContext(Generic[T]):
    """Saga execution context."""
    saga_id: UUID = field(default_factory=uuid4)
    saga_type: str = ""
    data: T = None  # type: ignore
    status: SagaStatus = SagaStatus.PENDING
    steps: list[SagaStep] = field(default_factory=list)
    current_step_index: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: datetime | None = None
    completed_at: datetime | None = None
    timeout_at: datetime | None = None
    error: str | None = None
    version: int = 1  # For optimistic locking

    def to_dict(self) -> dict:
        """Serialize for persistence."""
        return {
            "saga_id": str(self.saga_id),
            "saga_type": self.saga_type,
            "data": self.data if isinstance(self.data, dict) else self.data.__dict__,
            "status": self.status.value,
            "current_step_index": self.current_step_index,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "error": self.error,
            "version": self.version,
            "steps": [
                {
                    "name": s.name,
                    "status": s.status.value,
                    "executed_at": s.executed_at.isoformat() if s.executed_at else None,
                }
                for s in self.steps
            ],
        }


class BaseSaga(ABC, Generic[T]):
    """Base class for saga definitions."""

    saga_type: str = "base_saga"
    timeout_minutes: int = 30

    def __init__(self, data: T):
        self.context = SagaContext[T](
            saga_type=self.saga_type,
            data=data,
            steps=self.define_steps(),
            timeout_at=datetime.now(timezone.utc) + timedelta(minutes=self.timeout_minutes),
        )

    @abstractmethod
    def define_steps(self) -> list[SagaStep]:
        """Define saga steps with actions and compensations."""
        pass


class SagaOrchestrator:
    """
    Generic saga orchestrator with persistent state.

    Features:
    - Automatic state persistence after each step
    - Idempotent step execution
    - Compensation on failure
    - Timeout handling
    - Outbox pattern for events
    """

    def __init__(
        self,
        saga_repository,  # SagaRepository protocol
        event_publisher,  # EventPublisher protocol
        idempotency_store=None,  # Optional IdempotencyStore
    ):
        self.repo = saga_repository
        self.publisher = event_publisher
        self.idempotency = idempotency_store

    async def execute(self, saga: BaseSaga) -> SagaContext:
        """Execute saga with automatic compensation on failure."""
        ctx = saga.context
        ctx.status = SagaStatus.RUNNING
        ctx.started_at = datetime.now(timezone.utc)

        await self.repo.save(ctx)
        await self._publish_event(ctx, "saga.started")

        logger.info(
            "saga_started",
            saga_id=str(ctx.saga_id),
            saga_type=ctx.saga_type,
            steps=len(ctx.steps),
        )

        try:
            # Execute steps sequentially
            for i, step in enumerate(ctx.steps):
                ctx.current_step_index = i

                # Check timeout
                if ctx.timeout_at and datetime.now(timezone.utc) > ctx.timeout_at:
                    ctx.status = SagaStatus.TIMED_OUT
                    ctx.error = f"Saga timed out at step {step.name}"
                    await self.repo.save(ctx)
                    await self._compensate(ctx, i)
                    return ctx

                # Execute step
                success = await self._execute_step(ctx, step)
                if not success:
                    await self._compensate(ctx, i)
                    return ctx

            # All steps completed
            ctx.status = SagaStatus.COMPLETED
            ctx.completed_at = datetime.now(timezone.utc)
            await self.repo.save(ctx)
            await self._publish_event(ctx, "saga.completed")

            logger.info(
                "saga_completed",
                saga_id=str(ctx.saga_id),
                duration_ms=(ctx.completed_at - ctx.started_at).total_seconds() * 1000,
            )

        except Exception as e:
            ctx.status = SagaStatus.FAILED
            ctx.error = str(e)
            await self.repo.save(ctx)
            logger.exception("saga_failed", saga_id=str(ctx.saga_id), error=str(e))
            raise

        return ctx

    async def _execute_step(self, ctx: SagaContext, step: SagaStep) -> bool:
        """Execute a single step with idempotency check."""
        idempotency_key = f"{ctx.saga_id}:{step.name}"

        # Check if already executed (idempotency)
        if self.idempotency:
            existing = await self.idempotency.get(idempotency_key)
            if existing:
                logger.info("step_already_executed", step=step.name, saga_id=str(ctx.saga_id))
                step.status = StepStatus.COMPLETED
                step.result = StepResult(success=True, data=existing.get("data", {}))
                return True

        step.status = StepStatus.RUNNING
        step.executed_at = datetime.now(timezone.utc)
        await self.repo.save(ctx)

        logger.info("step_executing", step=step.name, saga_id=str(ctx.saga_id))

        try:
            # Execute with timeout
            result = await asyncio.wait_for(
                step.action(ctx.data),
                timeout=step.timeout_seconds,
            )

            step.status = StepStatus.COMPLETED
            step.result = StepResult(success=True, data=result or {})

            # Update context data with step result
            if isinstance(result, dict):
                if isinstance(ctx.data, dict):
                    ctx.data.update(result)
                else:
                    for key, value in result.items():
                        setattr(ctx.data, key, value)

            await self.repo.save(ctx)
            await self._publish_event(ctx, f"saga.step.{step.name}.completed", step.result.data)

            # Store for idempotency
            if self.idempotency:
                await self.idempotency.set(
                    idempotency_key,
                    {"data": step.result.data, "executed_at": datetime.now(timezone.utc).isoformat()},
                    ttl=timedelta(days=7),
                )

            logger.info("step_completed", step=step.name, saga_id=str(ctx.saga_id))
            return True

        except asyncio.TimeoutError:
            step.status = StepStatus.FAILED
            step.result = StepResult(success=False, error="Step timed out")
            ctx.error = f"Step {step.name} timed out after {step.timeout_seconds}s"
            await self.repo.save(ctx)
            logger.error("step_timeout", step=step.name, saga_id=str(ctx.saga_id))
            return False

        except Exception as e:
            step.status = StepStatus.FAILED
            step.result = StepResult(success=False, error=str(e))
            ctx.error = f"Step {step.name} failed: {e}"
            await self.repo.save(ctx)
            logger.error("step_failed", step=step.name, saga_id=str(ctx.saga_id), error=str(e))
            return False

    async def _compensate(self, ctx: SagaContext, failed_step_index: int) -> None:
        """Compensate completed steps in reverse order."""
        ctx.status = SagaStatus.COMPENSATING
        await self.repo.save(ctx)
        await self._publish_event(ctx, "saga.compensating", {"failed_step": failed_step_index})

        logger.info(
            "saga_compensating",
            saga_id=str(ctx.saga_id),
            from_step=failed_step_index,
        )

        # Compensate in reverse order
        for i in range(failed_step_index - 1, -1, -1):
            step = ctx.steps[i]

            if step.status != StepStatus.COMPLETED:
                continue

            step.status = StepStatus.COMPENSATING
            await self.repo.save(ctx)

            try:
                await asyncio.wait_for(
                    step.compensation(ctx.data),
                    timeout=step.timeout_seconds,
                )
                step.status = StepStatus.COMPENSATED
                step.compensated_at = datetime.now(timezone.utc)
                await self._publish_event(ctx, f"saga.step.{step.name}.compensated")
                logger.info("step_compensated", step=step.name, saga_id=str(ctx.saga_id))

            except Exception as e:
                # Compensation failed - requires manual intervention
                step.result = StepResult(success=False, error=f"Compensation failed: {e}")
                logger.error(
                    "compensation_failed",
                    step=step.name,
                    saga_id=str(ctx.saga_id),
                    error=str(e),
                )
                # Continue with other compensations

            await self.repo.save(ctx)

        ctx.status = SagaStatus.COMPENSATED
        ctx.completed_at = datetime.now(timezone.utc)
        await self.repo.save(ctx)
        await self._publish_event(ctx, "saga.compensated")

        logger.info("saga_compensated", saga_id=str(ctx.saga_id))

    async def _publish_event(
        self,
        ctx: SagaContext,
        event_type: str,
        payload: dict | None = None,
    ) -> None:
        """Publish saga event (uses outbox pattern if available)."""
        event = {
            "saga_id": str(ctx.saga_id),
            "saga_type": ctx.saga_type,
            "event_type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **(payload or {}),
        }
        await self.publisher.publish(f"saga.{ctx.saga_type}.{event_type}", event)

    async def resume(self, saga_id: UUID, from_step: int | None = None) -> SagaContext:
        """Resume a saga from current or specified step."""
        ctx = await self.repo.get(saga_id)
        if not ctx:
            raise ValueError(f"Saga {saga_id} not found")

        start_step = from_step if from_step is not None else ctx.current_step_index
        ctx.status = SagaStatus.RUNNING

        logger.info("saga_resuming", saga_id=str(saga_id), from_step=start_step)

        for i in range(start_step, len(ctx.steps)):
            ctx.current_step_index = i
            step = ctx.steps[i]

            success = await self._execute_step(ctx, step)
            if not success:
                await self._compensate(ctx, i)
                return ctx

        ctx.status = SagaStatus.COMPLETED
        ctx.completed_at = datetime.now(timezone.utc)
        await self.repo.save(ctx)
        return ctx


# Example usage - uncomment and modify for your use case:
#
# class OrderSaga(BaseSaga[OrderData]):
#     saga_type = "order_fulfillment"
#     timeout_minutes = 60
#
#     def __init__(self, order_data: OrderData, services: dict):
#         self.services = services
#         super().__init__(order_data)
#
#     def define_steps(self) -> list[SagaStep]:
#         return [
#             SagaStep(
#                 name="reserve_inventory",
#                 action=self._reserve_inventory,
#                 compensation=self._release_inventory,
#                 timeout_seconds=30,
#             ),
#             SagaStep(
#                 name="process_payment",
#                 action=self._process_payment,
#                 compensation=self._refund_payment,
#                 timeout_seconds=60,
#             ),
#             SagaStep(
#                 name="create_shipment",
#                 action=self._create_shipment,
#                 compensation=self._cancel_shipment,
#                 timeout_seconds=30,
#             ),
#         ]
#
#     async def _reserve_inventory(self, data: OrderData) -> dict:
#         result = await self.services["inventory"].reserve(data.items)
#         return {"reservation_id": result.id}
#
#     async def _release_inventory(self, data: OrderData) -> None:
#         await self.services["inventory"].release(data.reservation_id)
