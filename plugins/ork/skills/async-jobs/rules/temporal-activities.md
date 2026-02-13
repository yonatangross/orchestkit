---
title: Temporal Activity and Worker Patterns
impact: HIGH
impactDescription: "Activities handle all I/O — correct timeout, heartbeat, and retry configuration prevents data loss"
tags: temporal, activities, worker, heartbeat, retry, testing
---

## Temporal Activity and Worker Patterns

**Incorrect — missing heartbeat and error classification:**
```python
@activity.defn
async def process_payment(input: PaymentInput) -> PaymentResult:
    # WRONG: No heartbeat for long operation
    # WRONG: No error classification (all errors retry)
    response = await httpx.post("https://payments.example.com/charge",
        json={"order_id": input.order_id, "amount": input.amount})
    return PaymentResult(**response.json())
```

**Correct — heartbeat, error classification, and proper worker setup:**
```python
from temporalio import activity
from temporalio.exceptions import ApplicationError

@activity.defn
async def process_payment(input: PaymentInput) -> PaymentResult:
    activity.logger.info(f"Processing payment for order {input.order_id}")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://payments.example.com/charge",
                json={"order_id": input.order_id, "amount": input.amount})
            response.raise_for_status()
            return PaymentResult(**response.json())
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 402:
            # Non-retryable: payment declined is a business error
            raise ApplicationError("Payment declined",
                non_retryable=True, type="PaymentDeclined")
        raise  # Retryable: transient HTTP errors

@activity.defn
async def send_notification(input: NotificationInput) -> None:
    for i, recipient in enumerate(input.recipients):
        # Heartbeat for long operations (required for activities > 60s)
        activity.heartbeat(f"Sending {i+1}/{len(input.recipients)}")
        await send_email(recipient, input.subject, input.body)
```

### Worker Configuration

```python
from temporalio.client import Client
from temporalio.worker import Worker

async def main():
    client = await Client.connect("localhost:7233")
    worker = Worker(
        client,
        task_queue="order-processing",
        workflows=[OrderWorkflow],
        activities=[create_order, process_payment, reserve_inventory, cancel_order_activity],
    )
    await worker.run()

async def start_order_workflow(order_data: OrderInput) -> str:
    client = await Client.connect("localhost:7233")
    handle = await client.start_workflow(
        OrderWorkflow.run, order_data,
        id=f"order-{order_data.order_id}",
        task_queue="order-processing",
    )
    return handle.id
```

### Testing with WorkflowEnvironment

```python
import pytest
from temporalio.testing import WorkflowEnvironment

@pytest.fixture
async def workflow_env():
    async with await WorkflowEnvironment.start_local() as env:
        yield env

@pytest.mark.asyncio
async def test_order_workflow(workflow_env):
    async with Worker(workflow_env.client, task_queue="test",
            workflows=[OrderWorkflow],
            activities=[create_order, process_payment]):
        result = await workflow_env.client.execute_workflow(
            OrderWorkflow.run, OrderInput(id="test-1", total=100),
            id="test-order-1", task_queue="test",
        )
        assert result.order_id == "test-1"
```

### Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Activity timeout | `start_to_close` for most cases |
| Retry policy | 3 attempts default, exponential backoff |
| Heartbeating | Required for activities > 60s |
| Error handling | `ApplicationError(non_retryable=True)` for business errors |
| Worker deployment | Separate workers per task queue in production |
| Testing | `WorkflowEnvironment.start_local()` for integration tests |
