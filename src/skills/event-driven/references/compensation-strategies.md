# Compensation Strategies

Rollback and recovery patterns for saga failures.

## Compensation Types

| Type | Description | Example |
|------|-------------|---------|
| **Semantic** | Reverse business effect | Refund payment |
| **Technical** | Undo system state | Delete created record |
| **Notification** | Inform stakeholders | Send cancellation email |
| **Manual** | Requires human intervention | Complex refunds |

## Compensation Design Principles

### 1. Compensation Must Be Idempotent

```python
async def compensate_payment(self, saga_id: UUID, payment_id: UUID) -> None:
    """Idempotent refund - safe to call multiple times."""
    # Check if already compensated
    refund = await self.refund_repo.get_by_payment(payment_id)
    if refund and refund.status in ("completed", "pending"):
        logger.info(f"Payment {payment_id} already refunded")
        return

    # Create refund with idempotency key
    await self.payment_gateway.refund(
        payment_id=payment_id,
        idempotency_key=f"refund-{saga_id}-{payment_id}",
    )
```

### 2. Compensation Can Fail

**CRITICAL**: Handle compensation failures gracefully:

```python
class CompensationExecutor:
    async def execute_compensation(
        self,
        saga: SagaState,
        step: SagaStep,
    ) -> CompensationResult:
        """Execute compensation with retry and fallback."""
        for attempt in range(self.max_retries):
            try:
                await step.compensation(saga.data)
                return CompensationResult(status="completed")
            except Exception as e:
                logger.warning(f"Compensation attempt {attempt + 1} failed: {e}")
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

        # All retries failed - mark for manual intervention
        await self.manual_queue.enqueue(
            ManualCompensation(
                saga_id=saga.id,
                step_name=step.name,
                data=saga.data,
                error="Compensation failed after max retries",
            )
        )
        return CompensationResult(status="manual_required")
```

### 3. Partial Compensation

Some operations cannot be fully reversed:

```python
class ShippingCompensation:
    async def compensate(self, shipment_id: UUID) -> CompensationResult:
        """Compensate shipment based on current state."""
        shipment = await self.shipping_repo.get(shipment_id)

        match shipment.status:
            case "pending":
                # Can fully cancel
                await self.cancel_shipment(shipment_id)
                return CompensationResult(status="completed", type="full")

            case "in_transit":
                # Request return
                await self.request_return(shipment_id)
                return CompensationResult(status="completed", type="partial")

            case "delivered":
                # Can only refund, cannot undo delivery
                await self.initiate_return_process(shipment_id)
                return CompensationResult(status="completed", type="manual_return")
```

## Compensation Order Strategies

### Reverse Order (Default)

```
Execute:    [Reserve] -> [Pay] -> [Ship] -> FAIL
Compensate: [Cancel Ship] <- [Refund] <- [Release]
```

### Parallel Compensation

For independent steps, compensate in parallel:

```python
async def parallel_compensate(self, saga: SagaState) -> None:
    """Compensate independent steps concurrently."""
    # Group by dependency
    independent_steps = self.get_independent_steps(saga)
    dependent_steps = self.get_dependent_steps(saga)

    # Compensate independent steps in parallel
    async with asyncio.TaskGroup() as tg:
        for step in independent_steps:
            tg.create_task(step.compensation(saga.data))

    # Then compensate dependent steps in order
    for step in reversed(dependent_steps):
        await step.compensation(saga.data)
```

## Timeout-Based Compensation

Auto-compensate on timeout:

```python
class TimeoutCompensation:
    async def check_expired_sagas(self) -> None:
        """Compensate sagas that exceeded timeout."""
        expired = await self.saga_repo.find_expired(
            status=SagaStatus.RUNNING,
            timeout=timedelta(minutes=30),
        )

        for saga in expired:
            logger.warning(f"Saga {saga.id} timed out, compensating")
            saga.status = SagaStatus.COMPENSATING
            saga.timeout_reason = "execution_timeout"
            await self.compensate(saga)
```

## Compensation Audit Trail

**ALWAYS log compensation actions for audit**:

```python
@dataclass
class CompensationLog:
    saga_id: UUID
    step_name: str
    action: str
    status: str
    started_at: datetime
    completed_at: datetime | None
    error: str | None
    compensation_data: dict

# Store in append-only log
await self.db.execute(
    insert(compensation_logs).values(log.to_dict())
)
```

## Key Patterns

| Pattern | Description |
|---------|-------------|
| Idempotent compensation | Safe to retry |
| Compensation fallback | Manual queue when automated fails |
| Partial compensation | Handle irreversible operations |
| Compensation audit | Full traceability |
| Timeout compensation | Auto-cleanup stuck sagas |
