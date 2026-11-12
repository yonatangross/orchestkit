---
title: Define deterministic Temporal workflows with correct signal and query patterns
impact: HIGH
impactDescription: "Durable workflow execution requires deterministic definitions and correct signal/query patterns"
tags: temporal, workflow, durable-execution, saga, orchestration
---

## Temporal Workflow Definitions

**Incorrect — non-deterministic workflow operations:**
```python
@workflow.defn
class OrderWorkflow:
    @workflow.run
    async def run(self, order_data: OrderInput) -> OrderResult:
        # WRONG: Non-deterministic in workflow code
        if random.random() > 0.5:
            await do_something()
        if datetime.now() > deadline:
            await cancel()
        # WRONG: Direct I/O in workflow
        response = await httpx.get("https://api.example.com")
```

**Correct — deterministic workflow with proper APIs:**
```python
from temporalio import workflow
from temporalio.common import RetryPolicy
from datetime import timedelta

@workflow.defn
class OrderWorkflow:
    def __init__(self):
        self._status = "pending"
        self._order_id: str | None = None

    @workflow.run
    async def run(self, order_data: OrderInput) -> OrderResult:
        self._order_id = await workflow.execute_activity(
            create_order, order_data,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3, initial_interval=timedelta(seconds=1)),
        )
        self._status = "processing"

        # Parallel activities via asyncio.gather
        payment, inventory = await asyncio.gather(
            workflow.execute_activity(process_payment, PaymentInput(order_id=self._order_id),
                start_to_close_timeout=timedelta(minutes=5)),
            workflow.execute_activity(reserve_inventory, InventoryInput(order_id=self._order_id),
                start_to_close_timeout=timedelta(minutes=2)),
        )

        self._status = "completed"
        return OrderResult(order_id=self._order_id, payment_id=payment.id)

    @workflow.query
    def get_status(self) -> str:
        return self._status

    @workflow.signal
    async def cancel_order(self, reason: str):
        self._status = "cancelling"
        await workflow.execute_activity(cancel_order_activity,
            CancelInput(order_id=self._order_id),
            start_to_close_timeout=timedelta(seconds=30))
        self._status = "cancelled"
```

### Saga Pattern with Compensation

```python
@workflow.defn
class OrderSagaWorkflow:
    @workflow.run
    async def run(self, order: OrderInput) -> OrderResult:
        compensations: list[tuple[Callable, Any]] = []

        try:
            reservation = await workflow.execute_activity(
                reserve_inventory, order.items,
                start_to_close_timeout=timedelta(minutes=2))
            compensations.append((release_inventory, reservation.id))

            payment = await workflow.execute_activity(
                charge_payment, PaymentInput(order_id=order.id),
                start_to_close_timeout=timedelta(minutes=5))
            compensations.append((refund_payment, payment.id))

            shipment = await workflow.execute_activity(
                create_shipment, ShipmentInput(order_id=order.id),
                start_to_close_timeout=timedelta(minutes=3))
            return OrderResult(order_id=order.id, payment_id=payment.id, shipment_id=shipment.id)

        except Exception:
            workflow.logger.warning(f"Saga failed, running {len(compensations)} compensations")
            for compensate_fn, compensate_arg in reversed(compensations):
                try:
                    await workflow.execute_activity(compensate_fn, compensate_arg,
                        start_to_close_timeout=timedelta(minutes=2))
                except Exception as e:
                    workflow.logger.error(f"Compensation failed: {e}")
            raise
```

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Workflow ID | Business-meaningful, idempotent (e.g., `order-{order_id}`) |
| Task queue | Per-service or per-workflow-type |
| Determinism | Use `workflow.random()`, `workflow.now()` — never stdlib |
| I/O | Always via activities, never directly in workflows |
| Timers | `workflow.wait_condition()` with timeout for human-in-the-loop |
