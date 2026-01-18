# Order Processing Saga Example

Complete e-commerce order processing with inventory, payment, and shipping.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ORDER SAGA WORKFLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Order Request] ─────────────────────────────────────────► │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────┐                                       │
│  │ Reserve         │ ◄──── Compensation: Release           │
│  │ Inventory       │                                       │
│  └────────┬────────┘                                       │
│           │ success                                        │
│           ▼                                                │
│  ┌─────────────────┐                                       │
│  │ Charge          │ ◄──── Compensation: Refund            │
│  │ Payment         │                                       │
│  └────────┬────────┘                                       │
│           │ success                                        │
│           ▼                                                │
│  ┌─────────────────┐                                       │
│  │ Create          │ ◄──── Compensation: Cancel            │
│  │ Shipment        │                                       │
│  └────────┬────────┘                                       │
│           │ success                                        │
│           ▼                                                │
│  ┌─────────────────┐                                       │
│  │ Send            │ (no compensation needed)              │
│  │ Confirmation    │                                       │
│  └─────────────────┘                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Data Models

```python
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

class OrderStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    COMPENSATING = "compensating"

@dataclass
class OrderItem:
    sku: str
    quantity: int
    price: float

@dataclass
class Address:
    street: str
    city: str
    state: str
    zip_code: str
    country: str

@dataclass
class OrderInput:
    order_id: str
    customer_id: str
    items: list[OrderItem]
    shipping_address: Address
    payment_method_id: str

@dataclass
class OrderResult:
    order_id: str
    status: OrderStatus
    reservation_id: str | None = None
    payment_id: str | None = None
    shipment_id: str | None = None
    tracking_number: str | None = None
    error: str | None = None
```

## Activities

```python
from temporalio import activity
from temporalio.exceptions import ApplicationError
import httpx

@activity.defn
async def reserve_inventory(order_id: str, items: list[OrderItem]) -> str:
    """Reserve inventory for all items."""
    activity.logger.info(f"Reserving inventory for order {order_id}")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://inventory.internal/reservations",
            json={
                "order_id": order_id,
                "items": [{"sku": i.sku, "qty": i.quantity} for i in items],
            },
            timeout=30,
        )

        if response.status_code == 409:
            raise ApplicationError(
                "Insufficient inventory",
                non_retryable=True,
                type="InsufficientInventory",
            )

        response.raise_for_status()
        return response.json()["reservation_id"]

@activity.defn
async def release_inventory(reservation_id: str) -> None:
    """Compensation: Release reserved inventory."""
    activity.logger.info(f"Releasing reservation {reservation_id}")

    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f"https://inventory.internal/reservations/{reservation_id}",
            timeout=30,
        )
        # Ignore 404 - already released
        if response.status_code != 404:
            response.raise_for_status()

@activity.defn
async def charge_payment(
    order_id: str,
    customer_id: str,
    payment_method_id: str,
    amount: float,
) -> str:
    """Charge customer payment method."""
    activity.logger.info(f"Charging ${amount} for order {order_id}")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://payments.internal/charges",
            json={
                "order_id": order_id,
                "customer_id": customer_id,
                "payment_method_id": payment_method_id,
                "amount": amount,
                "currency": "USD",
                "idempotency_key": f"order-{order_id}",
            },
            timeout=60,
        )

        if response.status_code == 402:
            raise ApplicationError(
                "Payment declined",
                non_retryable=True,
                type="PaymentDeclined",
            )

        response.raise_for_status()
        return response.json()["payment_id"]

@activity.defn
async def refund_payment(payment_id: str) -> None:
    """Compensation: Refund payment."""
    activity.logger.info(f"Refunding payment {payment_id}")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://payments.internal/refunds",
            json={"payment_id": payment_id, "reason": "order_cancelled"},
            timeout=60,
        )
        response.raise_for_status()

@activity.defn
async def create_shipment(order_id: str, address: Address) -> dict:
    """Create shipment with carrier."""
    activity.logger.info(f"Creating shipment for order {order_id}")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://shipping.internal/shipments",
            json={
                "order_id": order_id,
                "address": {
                    "street": address.street,
                    "city": address.city,
                    "state": address.state,
                    "zip": address.zip_code,
                    "country": address.country,
                },
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return {
            "shipment_id": data["shipment_id"],
            "tracking_number": data["tracking_number"],
        }

@activity.defn
async def cancel_shipment(shipment_id: str) -> None:
    """Compensation: Cancel shipment."""
    activity.logger.info(f"Cancelling shipment {shipment_id}")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://shipping.internal/shipments/{shipment_id}/cancel",
            timeout=30,
        )
        # Ignore 409 - already shipped, compensation failed
        if response.status_code == 409:
            activity.logger.warning(f"Shipment {shipment_id} already shipped")
        elif response.status_code != 404:
            response.raise_for_status()

@activity.defn
async def send_confirmation(customer_id: str, order_id: str, tracking: str) -> None:
    """Send order confirmation email."""
    activity.logger.info(f"Sending confirmation for order {order_id}")
    # Implementation: Send email via notification service
```

## Workflow Implementation

```python
from temporalio import workflow
from temporalio.common import RetryPolicy
from datetime import timedelta

@workflow.defn
class OrderSagaWorkflow:
    def __init__(self):
        self._status = OrderStatus.PENDING
        self._reservation_id: str | None = None
        self._payment_id: str | None = None
        self._shipment: dict | None = None

    @workflow.run
    async def run(self, order: OrderInput) -> OrderResult:
        self._status = OrderStatus.PROCESSING
        compensations: list[tuple] = []

        try:
            # Step 1: Reserve inventory
            self._reservation_id = await workflow.execute_activity(
                reserve_inventory,
                args=[order.order_id, order.items],
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
            compensations.append((release_inventory, self._reservation_id))

            # Step 2: Charge payment
            total = sum(item.price * item.quantity for item in order.items)
            self._payment_id = await workflow.execute_activity(
                charge_payment,
                args=[order.order_id, order.customer_id, order.payment_method_id, total],
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=RetryPolicy(
                    maximum_attempts=3,
                    non_retryable_error_types=["PaymentDeclined"],
                ),
            )
            compensations.append((refund_payment, self._payment_id))

            # Step 3: Create shipment
            self._shipment = await workflow.execute_activity(
                create_shipment,
                args=[order.order_id, order.shipping_address],
                start_to_close_timeout=timedelta(minutes=3),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
            compensations.append((cancel_shipment, self._shipment["shipment_id"]))

            # Step 4: Send confirmation (no compensation needed)
            await workflow.execute_activity(
                send_confirmation,
                args=[order.customer_id, order.order_id, self._shipment["tracking_number"]],
                start_to_close_timeout=timedelta(seconds=30),
            )

            self._status = OrderStatus.COMPLETED
            return OrderResult(
                order_id=order.order_id,
                status=self._status,
                reservation_id=self._reservation_id,
                payment_id=self._payment_id,
                shipment_id=self._shipment["shipment_id"],
                tracking_number=self._shipment["tracking_number"],
            )

        except Exception as e:
            self._status = OrderStatus.COMPENSATING
            workflow.logger.warning(f"Order failed, compensating: {e}")

            # Run compensations in reverse
            for comp_fn, comp_arg in reversed(compensations):
                try:
                    await workflow.execute_activity(
                        comp_fn,
                        comp_arg,
                        start_to_close_timeout=timedelta(minutes=2),
                        retry_policy=RetryPolicy(maximum_attempts=5),
                    )
                except Exception as comp_error:
                    workflow.logger.error(f"Compensation failed: {comp_error}")

            self._status = OrderStatus.FAILED
            return OrderResult(
                order_id=order.order_id,
                status=self._status,
                error=str(e),
            )

    @workflow.query
    def get_status(self) -> OrderStatus:
        return self._status

    @workflow.signal
    async def cancel(self, reason: str):
        """Cancel order (if not yet shipped)."""
        if self._status == OrderStatus.COMPLETED:
            workflow.logger.warning("Cannot cancel completed order")
            return
        raise ApplicationError(f"Order cancelled: {reason}", non_retryable=True)
```

## Client Usage

```python
from temporalio.client import Client

async def place_order(order: OrderInput) -> OrderResult:
    client = await Client.connect("temporal.example.com:7233")

    # Start workflow with idempotent ID
    result = await client.execute_workflow(
        OrderSagaWorkflow.run,
        order,
        id=f"order-{order.order_id}",
        task_queue="orders",
    )
    return result

async def get_order_status(order_id: str) -> OrderStatus:
    client = await Client.connect("temporal.example.com:7233")
    handle = client.get_workflow_handle(f"order-{order_id}")
    return await handle.query(OrderSagaWorkflow.get_status)

async def cancel_order(order_id: str, reason: str):
    client = await Client.connect("temporal.example.com:7233")
    handle = client.get_workflow_handle(f"order-{order_id}")
    await handle.signal(OrderSagaWorkflow.cancel, reason)
```

## Testing

```python
import pytest
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

@pytest.mark.asyncio
async def test_order_saga_success():
    async with await WorkflowEnvironment.start_local() as env:
        async with Worker(
            env.client,
            task_queue="test",
            workflows=[OrderSagaWorkflow],
            activities=[
                reserve_inventory,
                charge_payment,
                create_shipment,
                send_confirmation,
            ],
        ):
            result = await env.client.execute_workflow(
                OrderSagaWorkflow.run,
                test_order,
                id="test-order-1",
                task_queue="test",
            )
            assert result.status == OrderStatus.COMPLETED
            assert result.tracking_number is not None

@pytest.mark.asyncio
async def test_order_saga_payment_failure():
    """Test compensation runs when payment fails."""
    async with await WorkflowEnvironment.start_local() as env:
        # Mock payment to fail
        @activity.defn(name="charge_payment")
        async def mock_payment(*args):
            raise ApplicationError("Declined", non_retryable=True)

        async with Worker(
            env.client,
            task_queue="test",
            workflows=[OrderSagaWorkflow],
            activities=[reserve_inventory, mock_payment, release_inventory],
        ):
            result = await env.client.execute_workflow(
                OrderSagaWorkflow.run,
                test_order,
                id="test-order-2",
                task_queue="test",
            )
            assert result.status == OrderStatus.FAILED
            # Verify inventory was released (compensation ran)
```
