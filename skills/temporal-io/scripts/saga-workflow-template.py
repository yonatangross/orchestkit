"""
Saga Workflow Template with Automatic Compensation

Implements the Saga pattern for distributed transactions with:
- Ordered step execution
- Automatic compensation on failure
- Compensation retry logic
- Structured logging
"""
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Callable, TypeVar

from temporalio import activity, workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ApplicationError


# ============================================================================
# Data Models
# ============================================================================
@dataclass
class SagaStep:
    """Represents a single saga step with its compensation."""
    name: str
    activity: str
    compensation_activity: str
    args: Any = None
    compensation_args: Any = None
    timeout: timedelta = field(default_factory=lambda: timedelta(minutes=5))


@dataclass
class SagaResult:
    """Result of saga execution."""
    success: bool
    completed_steps: list[str]
    failed_step: str | None = None
    error: str | None = None
    compensation_errors: list[str] = field(default_factory=list)


# ============================================================================
# Activities
# ============================================================================
@activity.defn
async def reserve_inventory(order_id: str, items: list[dict]) -> str:
    """Step 1: Reserve inventory."""
    activity.logger.info(f"Reserving inventory for order {order_id}")
    # Implementation: Call inventory service
    return f"reservation-{order_id}"


@activity.defn
async def release_inventory(reservation_id: str) -> None:
    """Compensation: Release reserved inventory."""
    activity.logger.info(f"Releasing reservation {reservation_id}")
    # Implementation: Call inventory service to release


@activity.defn
async def charge_payment(order_id: str, amount: float) -> str:
    """Step 2: Charge payment."""
    activity.logger.info(f"Charging {amount} for order {order_id}")
    # Implementation: Call payment processor
    return f"payment-{order_id}"


@activity.defn
async def refund_payment(payment_id: str) -> None:
    """Compensation: Refund payment."""
    activity.logger.info(f"Refunding payment {payment_id}")
    # Implementation: Call payment processor to refund


@activity.defn
async def create_shipment(order_id: str, address: dict) -> str:
    """Step 3: Create shipment."""
    activity.logger.info(f"Creating shipment for order {order_id}")
    # Implementation: Call shipping service
    return f"shipment-{order_id}"


@activity.defn
async def cancel_shipment(shipment_id: str) -> None:
    """Compensation: Cancel shipment."""
    activity.logger.info(f"Cancelling shipment {shipment_id}")
    # Implementation: Call shipping service to cancel


# ============================================================================
# Saga Workflow
# ============================================================================
@workflow.defn
class SagaWorkflow:
    """
    Generic Saga workflow with automatic compensation.

    Usage:
        result = await client.execute_workflow(
            SagaWorkflow.run,
            OrderSagaInput(order_id="123", items=[...], amount=99.99),
            id="order-saga-123",
            task_queue="orders",
        )
    """

    def __init__(self):
        self._completed_steps: list[tuple[str, Any]] = []
        self._status = "pending"

    @workflow.run
    async def run(self, input: "OrderSagaInput") -> SagaResult:
        """Execute saga steps with compensation on failure."""
        self._status = "running"

        # Define saga steps in order
        steps = [
            SagaStep(
                name="reserve_inventory",
                activity="reserve_inventory",
                compensation_activity="release_inventory",
                args=(input.order_id, input.items),
                timeout=timedelta(minutes=2),
            ),
            SagaStep(
                name="charge_payment",
                activity="charge_payment",
                compensation_activity="refund_payment",
                args=(input.order_id, input.amount),
                timeout=timedelta(minutes=5),
            ),
            SagaStep(
                name="create_shipment",
                activity="create_shipment",
                compensation_activity="cancel_shipment",
                args=(input.order_id, input.shipping_address),
                timeout=timedelta(minutes=3),
            ),
        ]

        try:
            # Execute steps in order
            for step in steps:
                result = await self._execute_step(step)
                self._completed_steps.append((step.compensation_activity, result))

            self._status = "completed"
            return SagaResult(
                success=True,
                completed_steps=[s.name for s in steps],
            )

        except Exception as e:
            self._status = "compensating"
            workflow.logger.warning(f"Saga failed at step, running compensations: {e}")

            # Run compensations in reverse order
            compensation_errors = await self._run_compensations()

            self._status = "failed"
            return SagaResult(
                success=False,
                completed_steps=[s[0] for s in self._completed_steps],
                failed_step=steps[len(self._completed_steps)].name if self._completed_steps else steps[0].name,
                error=str(e),
                compensation_errors=compensation_errors,
            )

    async def _execute_step(self, step: SagaStep) -> Any:
        """Execute a single saga step."""
        # Map activity names to functions
        activities = {
            "reserve_inventory": reserve_inventory,
            "charge_payment": charge_payment,
            "create_shipment": create_shipment,
        }

        activity_fn = activities[step.activity]
        return await workflow.execute_activity(
            activity_fn,
            args=step.args,
            start_to_close_timeout=step.timeout,
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                initial_interval=timedelta(seconds=1),
                backoff_coefficient=2.0,
            ),
        )

    async def _run_compensations(self) -> list[str]:
        """Run all compensations in reverse order."""
        errors = []

        # Map compensation activity names to functions
        compensations = {
            "release_inventory": release_inventory,
            "refund_payment": refund_payment,
            "cancel_shipment": cancel_shipment,
        }

        for compensation_activity, result in reversed(self._completed_steps):
            try:
                activity_fn = compensations[compensation_activity]
                await workflow.execute_activity(
                    activity_fn,
                    result,
                    start_to_close_timeout=timedelta(minutes=2),
                    retry_policy=RetryPolicy(
                        maximum_attempts=5,  # More retries for compensation
                        initial_interval=timedelta(seconds=2),
                        backoff_coefficient=2.0,
                    ),
                )
            except Exception as e:
                error_msg = f"Compensation {compensation_activity} failed: {e}"
                workflow.logger.error(error_msg)
                errors.append(error_msg)

        return errors

    @workflow.query
    def get_status(self) -> str:
        return self._status

    @workflow.query
    def get_completed_steps(self) -> list[str]:
        return [s[0] for s in self._completed_steps]


# ============================================================================
# Input Model
# ============================================================================
@dataclass
class OrderSagaInput:
    order_id: str
    items: list[dict]
    amount: float
    shipping_address: dict
