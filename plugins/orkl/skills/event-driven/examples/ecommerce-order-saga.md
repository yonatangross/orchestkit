# E-Commerce Order Saga Example

Complete production-ready order fulfillment saga with orchestration.

## Business Flow

```
Customer places order
        |
        v
+------------------+
| Reserve Inventory|---> Fail: Order rejected
+--------+---------+
         |
         v
+------------------+
| Process Payment  |---> Fail: Release inventory
+--------+---------+
         |
         v
+------------------+
| Create Shipment  |---> Fail: Refund + Release
+--------+---------+
         |
         v
+------------------+
|Send Confirmation |---> Fail: Cancel shipment + Refund + Release
+------------------+
         |
         v
    Order Complete
```

## Domain Models

```python
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID, uuid4


class OrderStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class OrderItem:
    sku: str
    quantity: int
    unit_price: Decimal
    name: str


@dataclass
class ShippingAddress:
    street: str
    city: str
    state: str
    postal_code: str
    country: str


@dataclass
class OrderData:
    """Data passed through the saga."""
    order_id: UUID = field(default_factory=uuid4)
    customer_id: UUID = None
    items: list[OrderItem] = field(default_factory=list)
    shipping_address: ShippingAddress = None
    total: Decimal = Decimal("0")
    currency: str = "USD"

    # Populated during saga execution
    reservation_id: UUID | None = None
    payment_id: UUID | None = None
    shipment_id: UUID | None = None
    tracking_number: str | None = None
```

## Saga Implementation

```python
from typing import Any
from saga_orchestrator_template import BaseSaga, SagaStep, SagaOrchestrator


class OrderFulfillmentSaga(BaseSaga[OrderData]):
    """
    Order fulfillment saga with 4 steps.

    Steps:
    1. Reserve inventory - Hold items for customer
    2. Process payment - Charge customer
    3. Create shipment - Dispatch order
    4. Send confirmation - Notify customer
    """

    saga_type = "order_fulfillment"
    timeout_minutes = 30

    def __init__(
        self,
        order_data: OrderData,
        inventory_service,
        payment_service,
        shipping_service,
        notification_service,
    ):
        self.inventory = inventory_service
        self.payment = payment_service
        self.shipping = shipping_service
        self.notification = notification_service
        super().__init__(order_data)

    def define_steps(self) -> list[SagaStep]:
        return [
            SagaStep(
                name="reserve_inventory",
                action=self._reserve_inventory,
                compensation=self._release_inventory,
                timeout_seconds=30,
            ),
            SagaStep(
                name="process_payment",
                action=self._process_payment,
                compensation=self._refund_payment,
                timeout_seconds=60,
            ),
            SagaStep(
                name="create_shipment",
                action=self._create_shipment,
                compensation=self._cancel_shipment,
                timeout_seconds=30,
            ),
            SagaStep(
                name="send_confirmation",
                action=self._send_confirmation,
                compensation=self._send_cancellation,
                timeout_seconds=15,
            ),
        ]

    # Step Actions

    async def _reserve_inventory(self, data: OrderData) -> dict[str, Any]:
        """Reserve inventory for order items."""
        reservation = await self.inventory.reserve(
            order_id=data.order_id,
            items=[
                {"sku": item.sku, "quantity": item.quantity}
                for item in data.items
            ],
            expires_in_minutes=30,
        )
        return {"reservation_id": reservation.id}

    async def _process_payment(self, data: OrderData) -> dict[str, Any]:
        """Process customer payment."""
        payment = await self.payment.charge(
            customer_id=data.customer_id,
            amount=data.total,
            currency=data.currency,
            order_id=data.order_id,
            idempotency_key=f"order-{data.order_id}-payment",
        )
        return {"payment_id": payment.id}

    async def _create_shipment(self, data: OrderData) -> dict[str, Any]:
        """Create shipment for order."""
        shipment = await self.shipping.create(
            order_id=data.order_id,
            address=data.shipping_address.__dict__,
            items=[
                {"sku": item.sku, "quantity": item.quantity, "name": item.name}
                for item in data.items
            ],
        )
        return {
            "shipment_id": shipment.id,
            "tracking_number": shipment.tracking_number,
        }

    async def _send_confirmation(self, data: OrderData) -> dict[str, Any]:
        """Send order confirmation to customer."""
        await self.notification.send_email(
            user_id=data.customer_id,
            template="order_confirmed",
            data={
                "order_id": str(data.order_id),
                "items": [item.name for item in data.items],
                "total": str(data.total),
                "tracking_number": data.tracking_number,
            },
        )
        return {}

    # Compensation Actions

    async def _release_inventory(self, data: OrderData) -> None:
        """Release reserved inventory."""
        if data.reservation_id:
            await self.inventory.release(
                reservation_id=data.reservation_id,
                reason="saga_compensation",
            )

    async def _refund_payment(self, data: OrderData) -> None:
        """Refund customer payment."""
        if data.payment_id:
            await self.payment.refund(
                payment_id=data.payment_id,
                reason="order_cancelled",
                idempotency_key=f"order-{data.order_id}-refund",
            )

    async def _cancel_shipment(self, data: OrderData) -> None:
        """Cancel shipment if possible."""
        if data.shipment_id:
            try:
                await self.shipping.cancel(
                    shipment_id=data.shipment_id,
                    reason="order_cancelled",
                )
            except ShipmentAlreadyDispatchedError:
                # Shipment already dispatched, initiate return
                await self.shipping.initiate_return(
                    shipment_id=data.shipment_id,
                )

    async def _send_cancellation(self, data: OrderData) -> None:
        """Send cancellation notification."""
        await self.notification.send_email(
            user_id=data.customer_id,
            template="order_cancelled",
            data={
                "order_id": str(data.order_id),
                "reason": "We were unable to process your order",
            },
        )
```

## API Endpoint

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from uuid import UUID

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


class CreateOrderRequest(BaseModel):
    customer_id: UUID
    items: list[dict]
    shipping_address: dict


class OrderResponse(BaseModel):
    order_id: UUID
    status: str
    tracking_number: str | None = None


@router.post("", response_model=OrderResponse)
async def create_order(
    request: CreateOrderRequest,
    orchestrator: SagaOrchestrator = Depends(get_orchestrator),
    inventory_service = Depends(get_inventory_service),
    payment_service = Depends(get_payment_service),
    shipping_service = Depends(get_shipping_service),
    notification_service = Depends(get_notification_service),
):
    """Create a new order and execute fulfillment saga."""

    # Build order data
    order_data = OrderData(
        customer_id=request.customer_id,
        items=[OrderItem(**item) for item in request.items],
        shipping_address=ShippingAddress(**request.shipping_address),
        total=sum(
            Decimal(str(item["unit_price"])) * item["quantity"]
            for item in request.items
        ),
    )

    # Create and execute saga
    saga = OrderFulfillmentSaga(
        order_data=order_data,
        inventory_service=inventory_service,
        payment_service=payment_service,
        shipping_service=shipping_service,
        notification_service=notification_service,
    )

    result = await orchestrator.execute(saga)

    if result.status == SagaStatus.COMPLETED:
        return OrderResponse(
            order_id=result.data.order_id,
            status="completed",
            tracking_number=result.data.tracking_number,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Order processing failed",
                "reason": result.error,
            },
        )


@router.get("/{order_id}/status")
async def get_order_status(
    order_id: UUID,
    saga_repo = Depends(get_saga_repository),
):
    """Get current order/saga status."""
    saga = await saga_repo.get_by_correlation_id(f"order-{order_id}")
    if not saga:
        raise HTTPException(status_code=404, detail="Order not found")

    return {
        "order_id": order_id,
        "saga_status": saga.status.value,
        "current_step": saga.steps[saga.current_step_index].name if saga.steps else None,
        "completed_steps": [
            s.name for s in saga.steps if s.status == StepStatus.COMPLETED
        ],
        "error": saga.error,
    }
```

## Testing

```python
import pytest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal


@pytest.fixture
def mock_services():
    return {
        "inventory": AsyncMock(),
        "payment": AsyncMock(),
        "shipping": AsyncMock(),
        "notification": AsyncMock(),
    }


@pytest.fixture
def order_data():
    return OrderData(
        customer_id=uuid4(),
        items=[
            OrderItem(sku="SKU-001", quantity=2, unit_price=Decimal("29.99"), name="Widget"),
        ],
        shipping_address=ShippingAddress(
            street="123 Main St",
            city="Anytown",
            state="CA",
            postal_code="12345",
            country="US",
        ),
        total=Decimal("59.98"),
    )


@pytest.mark.asyncio
async def test_saga_happy_path(mock_services, order_data, saga_repo, event_publisher):
    """Test successful order fulfillment."""
    # Setup mocks
    mock_services["inventory"].reserve.return_value = MagicMock(id=uuid4())
    mock_services["payment"].charge.return_value = MagicMock(id=uuid4())
    mock_services["shipping"].create.return_value = MagicMock(
        id=uuid4(),
        tracking_number="TRACK123",
    )

    # Execute saga
    saga = OrderFulfillmentSaga(order_data, **mock_services)
    orchestrator = SagaOrchestrator(saga_repo, event_publisher)
    result = await orchestrator.execute(saga)

    # Assertions
    assert result.status == SagaStatus.COMPLETED
    assert result.data.tracking_number == "TRACK123"
    mock_services["inventory"].reserve.assert_called_once()
    mock_services["payment"].charge.assert_called_once()
    mock_services["shipping"].create.assert_called_once()
    mock_services["notification"].send_email.assert_called_once()


@pytest.mark.asyncio
async def test_saga_payment_failure_triggers_compensation(
    mock_services, order_data, saga_repo, event_publisher
):
    """Test that payment failure triggers inventory release."""
    # Setup mocks
    mock_services["inventory"].reserve.return_value = MagicMock(id=uuid4())
    mock_services["payment"].charge.side_effect = PaymentDeclinedError("Insufficient funds")

    # Execute saga
    saga = OrderFulfillmentSaga(order_data, **mock_services)
    orchestrator = SagaOrchestrator(saga_repo, event_publisher)
    result = await orchestrator.execute(saga)

    # Assertions
    assert result.status == SagaStatus.COMPENSATED
    mock_services["inventory"].release.assert_called_once()  # Compensation
    mock_services["payment"].refund.assert_not_called()  # Payment never succeeded


@pytest.mark.asyncio
async def test_saga_idempotency(mock_services, order_data, saga_repo, event_publisher, idempotency_store):
    """Test that saga steps are idempotent."""
    reservation_id = uuid4()
    mock_services["inventory"].reserve.return_value = MagicMock(id=reservation_id)

    # First execution
    saga1 = OrderFulfillmentSaga(order_data, **mock_services)
    orchestrator = SagaOrchestrator(saga_repo, event_publisher, idempotency_store)

    # Simulate partial execution - reserve succeeds, then crash
    await orchestrator._execute_step(saga1.context, saga1.context.steps[0])

    # Second execution - should use cached result
    mock_services["inventory"].reserve.reset_mock()
    saga2 = OrderFulfillmentSaga(order_data, **mock_services)
    saga2.context.saga_id = saga1.context.saga_id  # Same saga ID

    result = await orchestrator.execute(saga2)

    # Reserve should not be called again
    mock_services["inventory"].reserve.assert_not_called()
    assert result.data.reservation_id == reservation_id
```

## Metrics Dashboard

```yaml
# Grafana dashboard panels
panels:
  - title: "Saga Completion Rate"
    query: |
      sum(rate(saga_executions_total{saga_type="order_fulfillment", status="completed"}[5m]))
      /
      sum(rate(saga_executions_total{saga_type="order_fulfillment"}[5m]))

  - title: "Average Saga Duration"
    query: |
      histogram_quantile(0.95,
        sum(rate(saga_duration_seconds_bucket{saga_type="order_fulfillment"}[5m])) by (le)
      )

  - title: "Step Failure Rate"
    query: |
      sum(rate(saga_step_failures_total{saga_type="order_fulfillment"}[5m])) by (step)

  - title: "Active Compensations"
    query: |
      sum(saga_states{saga_type="order_fulfillment", status="compensating"})
```
