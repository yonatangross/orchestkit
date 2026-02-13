# Compensation Logic Checklist

Best practices for implementing saga compensation (rollback) logic.

## Compensation Fundamentals

### Core Principles

- [ ] **Semantic Undo**: Compensation reverses the business effect, not necessarily the technical operation
- [ ] **Idempotent**: Safe to execute multiple times with same result
- [ ] **Isolated**: Does not depend on other compensations succeeding
- [ ] **Documented**: Clear description of what gets reversed and how

### Understanding Compensation vs Rollback

| Aspect | Database Rollback | Saga Compensation |
|--------|-------------------|-------------------|
| Scope | Single transaction | Distributed |
| Timing | Immediate | Async/delayed |
| Guarantee | ACID | Eventual |
| Side Effects | None | May have (e.g., refund fee) |
| State | Exact reversal | Semantic reversal |

---

## Compensation Design

### For Each Step, Define

- [ ] **What gets reversed**: Specific business action being undone
- [ ] **Required data**: Information needed from original action
- [ ] **External effects**: API calls, notifications, third-party systems
- [ ] **Partial success handling**: What if original action partially completed
- [ ] **Time sensitivity**: Does compensation have a deadline?

### Data Requirements

Ensure compensation has access to:

- [ ] **Identifiers**: reservation_id, payment_id, shipment_id, etc.
- [ ] **Original amounts**: For refunds, inventory release
- [ ] **Customer info**: For notifications
- [ ] **Timestamps**: For audit and time-based decisions

```python
# Good: Compensation has all required data
async def refund_payment(data: dict) -> None:
    await payment_service.refund(
        payment_id=data["payment_id"],      # From process_payment step
        amount=data["charged_amount"],       # Original amount
        reason=f"Order {data['order_id']} cancelled",
        idempotency_key=f"refund-{data['saga_id']}-{data['payment_id']}",
    )
```

---

## Idempotency Patterns

### Key Generation

- [ ] Include saga_id in key
- [ ] Include step name in key
- [ ] Include entity identifier (payment_id, reservation_id)
- [ ] DO NOT include timestamps or random values

```python
def compensation_idempotency_key(saga_id: str, step: str, entity_id: str) -> str:
    """Generate deterministic compensation idempotency key."""
    return f"comp:{saga_id}:{step}:{entity_id}"
```

### Idempotency Verification

- [ ] Check if compensation already executed BEFORE calling external service
- [ ] Store compensation result with TTL (7+ days)
- [ ] Log when returning cached result

```python
async def refund_payment(data: dict) -> None:
    key = compensation_idempotency_key(data["saga_id"], "refund", data["payment_id"])

    # Check if already compensated
    if await idempotency_store.exists(key):
        logger.info("refund_already_processed", payment_id=data["payment_id"])
        return

    # Execute compensation
    result = await payment_service.refund(data["payment_id"])

    # Store result
    await idempotency_store.set(key, {"refunded_at": datetime.now(timezone.utc)}, ttl=days(7))
```

---

## Service-Specific Patterns

### Payment Refund

- [ ] Use idempotency key to prevent duplicate refunds
- [ ] Handle partial refunds if applicable
- [ ] Account for refund fees (some processors charge)
- [ ] Verify payment status before refunding (already refunded?)
- [ ] Consider delayed refund for fraud prevention

```python
async def refund_payment(data: dict) -> None:
    # Check if payment exists and is refundable
    payment = await payment_service.get(data["payment_id"])
    if payment.status == "refunded":
        return  # Already compensated
    if payment.status == "disputed":
        raise CompensationError("Cannot refund disputed payment - manual intervention required")

    await payment_service.refund(
        payment_id=data["payment_id"],
        amount=payment.amount,  # Full refund
        idempotency_key=f"refund-{data['saga_id']}",
    )
```

### Inventory Release

- [ ] Verify reservation exists before releasing
- [ ] Handle expired reservations (may already be released)
- [ ] Restore to correct inventory location/warehouse
- [ ] Update stock counts atomically

```python
async def release_inventory(data: dict) -> None:
    reservation = await inventory_service.get_reservation(data["reservation_id"])
    if not reservation:
        logger.warning("reservation_not_found", reservation_id=data["reservation_id"])
        return  # May have expired or been released

    if reservation.status == "released":
        return  # Already compensated

    await inventory_service.release(
        reservation_id=data["reservation_id"],
        idempotency_key=f"release-{data['saga_id']}",
    )
```

### Shipment Cancellation

- [ ] Check shipment status (can't cancel if already shipped)
- [ ] Handle carrier-specific cancellation APIs
- [ ] Update tracking status
- [ ] Notify customer if shipment was visible to them

```python
async def cancel_shipment(data: dict) -> None:
    if "shipment_id" not in data:
        return  # Shipment step never completed

    shipment = await shipping_service.get(data["shipment_id"])
    if shipment.status in ("shipped", "delivered"):
        # Can't cancel - initiate return process instead
        await returns_service.initiate(
            shipment_id=data["shipment_id"],
            reason="order_cancelled",
        )
        return

    await shipping_service.cancel(
        shipment_id=data["shipment_id"],
        idempotency_key=f"cancel-{data['saga_id']}",
    )
```

### Notification Reversal

- [ ] Send appropriate cancellation message
- [ ] Don't spam: check if original notification was sent
- [ ] Include reason for cancellation
- [ ] Consider notification preference (email, push, SMS)

```python
async def send_cancellation_notification(data: dict) -> None:
    # Only send if original confirmation was sent
    if data.get("confirmation_sent"):
        await notification_service.send(
            user_id=data["customer_id"],
            template="order_cancelled",
            data={
                "order_id": data["order_id"],
                "reason": data.get("cancellation_reason", "Order processing failed"),
            },
        )
```

---

## Error Handling

### Compensation Failure Strategy

- [ ] Log detailed error with saga_id and step name
- [ ] Continue with remaining compensations (don't block)
- [ ] Record failed compensation for manual intervention
- [ ] Alert operations team if critical

```python
async def compensate(saga: SagaContext, failed_step_index: int) -> None:
    compensation_errors = []

    for i in range(failed_step_index - 1, -1, -1):
        step = saga.steps[i]
        if step.status != StepStatus.COMPLETED:
            continue

        try:
            await step.compensation(saga.data)
            step.status = StepStatus.COMPENSATED
        except Exception as e:
            # Log but continue
            logger.error("compensation_failed", step=step.name, error=str(e))
            compensation_errors.append({"step": step.name, "error": str(e)})
            # Don't re-raise - continue with other compensations

    if compensation_errors:
        # Alert for manual intervention
        await alerting.send(
            channel="saga-compensation-failures",
            message=f"Saga {saga.saga_id} had {len(compensation_errors)} compensation failures",
            details=compensation_errors,
        )
```

### Retry vs Skip Decision

| Error Type | Action | Example |
|------------|--------|---------|
| Network timeout | Retry with backoff | Connection refused |
| 429 Rate limited | Retry with delay | Too many requests |
| 400 Bad request | Log and skip | Invalid payment_id |
| 404 Not found | Log and skip | Reservation expired |
| 500 Server error | Retry limited times | DB unavailable |
| Business rule | Log for manual | Already refunded |

---

## Testing Compensation

### Unit Test Scenarios

- [ ] Normal compensation path
- [ ] Compensation when data is missing
- [ ] Compensation when entity already compensated (idempotency)
- [ ] Compensation when external service fails
- [ ] Compensation with partial data (action partially succeeded)

```python
@pytest.mark.asyncio
async def test_refund_payment_idempotent():
    """Compensation should be safe to call multiple times."""
    data = {"saga_id": "test-1", "payment_id": "pay-123", "charged_amount": 100}

    # First call
    await refund_payment(data)
    assert payment_service.refund.call_count == 1

    # Second call (idempotent - should not call service again)
    await refund_payment(data)
    assert payment_service.refund.call_count == 1  # Still 1


@pytest.mark.asyncio
async def test_release_inventory_already_released():
    """Should handle already-released reservations gracefully."""
    inventory_service.get_reservation.return_value = Reservation(
        id="res-123",
        status="released",  # Already compensated
    )

    data = {"saga_id": "test-1", "reservation_id": "res-123"}

    # Should not raise, should not call release
    await release_inventory(data)
    assert inventory_service.release.call_count == 0


@pytest.mark.asyncio
async def test_cancel_shipment_already_shipped():
    """Should initiate return instead of cancel for shipped items."""
    shipping_service.get.return_value = Shipment(
        id="ship-123",
        status="shipped",  # Can't cancel
    )

    data = {"saga_id": "test-1", "shipment_id": "ship-123"}

    await cancel_shipment(data)

    # Should initiate return, not cancel
    assert returns_service.initiate.call_count == 1
    assert shipping_service.cancel.call_count == 0
```

### Integration Test Scenarios

- [ ] Full saga failure at each step triggers correct compensations
- [ ] Compensation order is reverse of execution order
- [ ] Failed compensation does not block subsequent compensations
- [ ] All compensations complete even if some fail

---

## Common Pitfalls

| Pitfall | Impact | Prevention |
|---------|--------|------------|
| Forgetting to check if already compensated | Duplicate refunds | Idempotency check first |
| Blocking on compensation failure | Saga stuck | Log and continue |
| Missing data for compensation | Compensation fails | Design data flow carefully |
| Compensation with side effects | Unexpected behavior | Document side effects |
| Time-sensitive compensation | Missed window | Track deadlines |
| Not testing partial success | Data corruption | Test edge cases |

---

## Compensation Documentation Template

For each step, document:

```markdown
## Step: {step_name}

### Action
- **Description**: {what the step does}
- **External calls**: {APIs called}
- **Data produced**: {what gets added to saga context}

### Compensation
- **Description**: {what compensation does}
- **Required data**: {data needed from context}
- **Idempotency key**: {key format}
- **Side effects**: {any side effects like fees}
- **Time limit**: {any deadline for compensation}

### Edge Cases
- **Already compensated**: {behavior}
- **Entity not found**: {behavior}
- **Partial success**: {behavior}

### Manual Intervention
- **When required**: {conditions}
- **Runbook link**: {link to runbook}
```

---

**Last Updated**: 2026-01-18
**Version**: 1.0.0
