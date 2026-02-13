"""
Order Fulfillment Saga Example

A complete example of an e-commerce order fulfillment saga with:
- Inventory reservation
- Payment processing
- Shipping creation
- Notification
- Full compensation support

Demonstrates:
- Step-by-step orchestration
- Idempotent operations
- Parallel execution where possible
- Production-ready error handling
- FastAPI integration
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Protocol
from uuid import UUID

from pydantic import BaseModel, Field
from uuid_utils import uuid7


# -----------------------------------------------------------------------------
# Domain Models
# -----------------------------------------------------------------------------


class OrderStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


@dataclass
class OrderItem:
    product_id: str
    product_name: str
    quantity: int
    unit_price: Decimal
    sku: str

    @property
    def total_price(self) -> Decimal:
        return self.unit_price * self.quantity


@dataclass
class Order:
    order_id: str
    customer_id: str
    items: list[OrderItem]
    shipping_address: dict[str, str]
    billing_address: dict[str, str]
    status: OrderStatus = OrderStatus.PENDING
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def total(self) -> Decimal:
        return sum(item.total_price for item in self.items)


class CreateOrderRequest(BaseModel):
    """API request for creating an order."""

    customer_id: UUID
    items: list[dict]  # [{product_id, quantity}]
    shipping_address: dict[str, str]
    billing_address: dict[str, str]
    payment_method_id: str


class OrderResponse(BaseModel):
    """API response for order operations."""

    order_id: str
    saga_id: str
    status: str
    tracking_number: str | None = None
    total: Decimal
    message: str


# -----------------------------------------------------------------------------
# Service Protocols
# -----------------------------------------------------------------------------


class InventoryService(Protocol):
    async def check_availability(
        self,
        items: list[dict],
    ) -> dict[str, int]:
        """Check stock levels. Returns {product_id: available_qty}."""
        ...

    async def reserve(
        self,
        order_id: str,
        items: list[dict],
        idempotency_key: str,
    ) -> str:
        """Reserve inventory. Returns reservation_id."""
        ...

    async def release(
        self,
        reservation_id: str,
        idempotency_key: str,
    ) -> None:
        """Release reserved inventory."""
        ...

    async def commit(
        self,
        reservation_id: str,
        idempotency_key: str,
    ) -> None:
        """Commit reservation (deduct from actual inventory)."""
        ...


class PaymentService(Protocol):
    async def charge(
        self,
        amount: Decimal,
        customer_id: str,
        payment_method_id: str,
        order_id: str,
        idempotency_key: str,
    ) -> str:
        """Charge customer. Returns payment_id."""
        ...

    async def refund(
        self,
        payment_id: str,
        amount: Decimal | None,
        reason: str,
        idempotency_key: str,
    ) -> str:
        """Refund payment. Returns refund_id."""
        ...


class ShippingService(Protocol):
    async def create_shipment(
        self,
        order_id: str,
        items: list[dict],
        shipping_address: dict[str, str],
        idempotency_key: str,
    ) -> dict:
        """Create shipment. Returns {shipment_id, tracking_number, label_url}."""
        ...

    async def cancel_shipment(
        self,
        shipment_id: str,
        idempotency_key: str,
    ) -> None:
        """Cancel shipment before pickup."""
        ...


class NotificationService(Protocol):
    async def send_order_confirmation(
        self,
        customer_id: str,
        order_id: str,
        items: list[dict],
        tracking_number: str,
        total: Decimal,
    ) -> None:
        ...

    async def send_order_cancelled(
        self,
        customer_id: str,
        order_id: str,
        reason: str,
    ) -> None:
        ...


class OrderRepository(Protocol):
    async def create(self, order: Order) -> None:
        ...

    async def update_status(self, order_id: str, status: OrderStatus) -> None:
        ...

    async def get(self, order_id: str) -> Order | None:
        ...


# -----------------------------------------------------------------------------
# Saga Implementation
# -----------------------------------------------------------------------------


class SagaStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"
    FAILED = "failed"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    COMPENSATED = "compensated"


@dataclass
class SagaStep:
    name: str
    action: Any
    compensation: Any
    timeout_seconds: int = 60
    retries: int = 3
    status: StepStatus = StepStatus.PENDING
    result: dict = field(default_factory=dict)
    error: str | None = None
    attempts: int = 0


@dataclass
class OrderFulfillmentContext:
    """Saga execution context."""

    saga_id: str = field(default_factory=lambda: str(uuid7()))
    status: SagaStatus = SagaStatus.PENDING

    # Input
    order: Order | None = None
    payment_method_id: str | None = None

    # Step results
    reservation_id: str | None = None
    payment_id: str | None = None
    shipment_id: str | None = None
    tracking_number: str | None = None
    label_url: str | None = None

    # Timestamps
    started_at: datetime | None = None
    completed_at: datetime | None = None


class OrderFulfillmentSaga:
    """
    Order fulfillment saga coordinating:
    1. Inventory reservation
    2. Payment processing
    3. Inventory commit
    4. Shipment creation
    5. Notification

    Compensation flow:
    - Payment failure: Release inventory
    - Shipment failure: Refund payment, release inventory
    """

    def __init__(
        self,
        inventory_service: InventoryService,
        payment_service: PaymentService,
        shipping_service: ShippingService,
        notification_service: NotificationService,
        order_repository: OrderRepository,
        saga_repository: Any,
    ):
        self.inventory = inventory_service
        self.payment = payment_service
        self.shipping = shipping_service
        self.notification = notification_service
        self.order_repo = order_repository
        self.saga_repo = saga_repository

    async def execute(
        self,
        order: Order,
        payment_method_id: str,
    ) -> OrderFulfillmentContext:
        """Execute order fulfillment saga."""
        ctx = OrderFulfillmentContext(
            order=order,
            payment_method_id=payment_method_id,
        )
        ctx.status = SagaStatus.RUNNING
        ctx.started_at = datetime.now(timezone.utc)

        # Update order status
        await self.order_repo.update_status(order.order_id, OrderStatus.PROCESSING)
        await self.saga_repo.save(ctx)

        steps = self._build_steps(ctx)
        failed_at_index: int | None = None

        for i, step in enumerate(steps):
            step.status = StepStatus.RUNNING
            await self.saga_repo.save(ctx)

            success = await self._execute_step_with_retry(ctx, step)

            if not success:
                failed_at_index = i
                break

            await self.saga_repo.save(ctx)

        if failed_at_index is not None:
            await self._compensate(ctx, steps, failed_at_index)
            await self.order_repo.update_status(order.order_id, OrderStatus.CANCELLED)
        else:
            ctx.status = SagaStatus.COMPLETED
            ctx.completed_at = datetime.now(timezone.utc)
            await self.order_repo.update_status(order.order_id, OrderStatus.COMPLETED)

        await self.saga_repo.save(ctx)
        return ctx

    def _build_steps(self, ctx: OrderFulfillmentContext) -> list[SagaStep]:
        """Build ordered list of saga steps."""
        return [
            SagaStep(
                name="reserve_inventory",
                action=lambda: self._reserve_inventory(ctx),
                compensation=lambda: self._release_inventory(ctx),
                timeout_seconds=30,
                retries=3,
            ),
            SagaStep(
                name="process_payment",
                action=lambda: self._process_payment(ctx),
                compensation=lambda: self._refund_payment(ctx),
                timeout_seconds=60,
                retries=2,
            ),
            SagaStep(
                name="commit_inventory",
                action=lambda: self._commit_inventory(ctx),
                compensation=lambda: None,  # Can't uncommit after commit
                timeout_seconds=30,
                retries=3,
            ),
            SagaStep(
                name="create_shipment",
                action=lambda: self._create_shipment(ctx),
                compensation=lambda: self._cancel_shipment(ctx),
                timeout_seconds=30,
                retries=3,
            ),
            SagaStep(
                name="send_confirmation",
                action=lambda: self._send_confirmation(ctx),
                compensation=lambda: None,  # Fire and forget
                timeout_seconds=10,
                retries=2,
            ),
        ]

    async def _execute_step_with_retry(
        self,
        ctx: OrderFulfillmentContext,
        step: SagaStep,
    ) -> bool:
        """Execute step with retry logic."""
        last_error: str | None = None

        for attempt in range(step.retries):
            step.attempts = attempt + 1

            try:
                result = await asyncio.wait_for(
                    step.action(),
                    timeout=step.timeout_seconds,
                )
                step.result = result or {}
                step.status = StepStatus.COMPLETED
                return True

            except asyncio.TimeoutError:
                last_error = f"Step timed out after {step.timeout_seconds}s"

            except Exception as e:
                last_error = str(e)

                # Check if retryable
                if not self._is_retryable(e):
                    break

            # Wait before retry (exponential backoff)
            if attempt < step.retries - 1:
                delay = (2 ** attempt) + (asyncio.get_event_loop().time() % 1)
                await asyncio.sleep(delay)

        step.status = StepStatus.FAILED
        step.error = last_error
        return False

    def _is_retryable(self, error: Exception) -> bool:
        """Determine if error is transient and should be retried."""
        error_str = str(error).lower()
        retryable_indicators = (
            "timeout",
            "connection",
            "temporarily",
            "retry",
            "429",
            "503",
            "504",
        )
        return any(ind in error_str for ind in retryable_indicators)

    async def _compensate(
        self,
        ctx: OrderFulfillmentContext,
        steps: list[SagaStep],
        failed_index: int,
    ) -> None:
        """Execute compensations in reverse order."""
        ctx.status = SagaStatus.COMPENSATING
        await self.saga_repo.save(ctx)

        for i in range(failed_index - 1, -1, -1):
            step = steps[i]
            if step.status != StepStatus.COMPLETED:
                continue

            try:
                await asyncio.wait_for(
                    step.compensation(),
                    timeout=step.timeout_seconds,
                )
                step.status = StepStatus.COMPENSATED

            except Exception as e:
                step.error = f"Compensation failed: {e}"
                # Log but continue

            await self.saga_repo.save(ctx)

        # Send cancellation notification
        try:
            await self.notification.send_order_cancelled(
                customer_id=ctx.order.customer_id,
                order_id=ctx.order.order_id,
                reason="Order processing failed",
            )
        except Exception:
            pass

        ctx.status = SagaStatus.COMPENSATED
        ctx.completed_at = datetime.now(timezone.utc)

    # -------------------------------------------------------------------------
    # Step Implementations
    # -------------------------------------------------------------------------

    async def _reserve_inventory(self, ctx: OrderFulfillmentContext) -> dict:
        """Step 1: Reserve inventory."""
        items = [
            {"product_id": item.product_id, "quantity": item.quantity, "sku": item.sku}
            for item in ctx.order.items
        ]

        reservation_id = await self.inventory.reserve(
            order_id=ctx.order.order_id,
            items=items,
            idempotency_key=f"reserve-{ctx.saga_id}",
        )

        ctx.reservation_id = reservation_id
        return {"reservation_id": reservation_id}

    async def _release_inventory(self, ctx: OrderFulfillmentContext) -> None:
        """Compensation for Step 1: Release reserved inventory."""
        if ctx.reservation_id:
            await self.inventory.release(
                reservation_id=ctx.reservation_id,
                idempotency_key=f"release-{ctx.saga_id}",
            )

    async def _process_payment(self, ctx: OrderFulfillmentContext) -> dict:
        """Step 2: Process payment."""
        payment_id = await self.payment.charge(
            amount=ctx.order.total,
            customer_id=ctx.order.customer_id,
            payment_method_id=ctx.payment_method_id,
            order_id=ctx.order.order_id,
            idempotency_key=f"payment-{ctx.saga_id}",
        )

        ctx.payment_id = payment_id
        return {"payment_id": payment_id}

    async def _refund_payment(self, ctx: OrderFulfillmentContext) -> None:
        """Compensation for Step 2: Refund payment."""
        if ctx.payment_id:
            await self.payment.refund(
                payment_id=ctx.payment_id,
                amount=None,  # Full refund
                reason="Order cancelled",
                idempotency_key=f"refund-{ctx.saga_id}",
            )

    async def _commit_inventory(self, ctx: OrderFulfillmentContext) -> dict:
        """Step 3: Commit inventory (deduct from stock)."""
        await self.inventory.commit(
            reservation_id=ctx.reservation_id,
            idempotency_key=f"commit-{ctx.saga_id}",
        )
        return {"inventory_committed": True}

    async def _create_shipment(self, ctx: OrderFulfillmentContext) -> dict:
        """Step 4: Create shipment."""
        items = [
            {
                "sku": item.sku,
                "name": item.product_name,
                "quantity": item.quantity,
            }
            for item in ctx.order.items
        ]

        result = await self.shipping.create_shipment(
            order_id=ctx.order.order_id,
            items=items,
            shipping_address=ctx.order.shipping_address,
            idempotency_key=f"shipment-{ctx.saga_id}",
        )

        ctx.shipment_id = result["shipment_id"]
        ctx.tracking_number = result["tracking_number"]
        ctx.label_url = result.get("label_url")

        return result

    async def _cancel_shipment(self, ctx: OrderFulfillmentContext) -> None:
        """Compensation for Step 4: Cancel shipment."""
        if ctx.shipment_id:
            await self.shipping.cancel_shipment(
                shipment_id=ctx.shipment_id,
                idempotency_key=f"cancel-shipment-{ctx.saga_id}",
            )

    async def _send_confirmation(self, ctx: OrderFulfillmentContext) -> dict:
        """Step 5: Send confirmation notification."""
        items = [
            {
                "name": item.product_name,
                "quantity": item.quantity,
                "price": str(item.total_price),
            }
            for item in ctx.order.items
        ]

        await self.notification.send_order_confirmation(
            customer_id=ctx.order.customer_id,
            order_id=ctx.order.order_id,
            items=items,
            tracking_number=ctx.tracking_number,
            total=ctx.order.total,
        )

        return {"notification_sent": True}


# -----------------------------------------------------------------------------
# FastAPI Integration
# -----------------------------------------------------------------------------


def create_order_router(
    saga: OrderFulfillmentSaga,
    product_catalog: Any,  # ProductCatalog protocol
):
    """Create FastAPI router for order fulfillment."""
    from fastapi import APIRouter, HTTPException, BackgroundTasks

    router = APIRouter(prefix="/orders", tags=["orders"])

    @router.post("/", response_model=OrderResponse)
    async def create_order(
        request: CreateOrderRequest,
        background_tasks: BackgroundTasks,
    ) -> OrderResponse:
        """
        Create and fulfill an order.

        Initiates an order fulfillment saga that:
        1. Reserves inventory
        2. Processes payment
        3. Creates shipment
        4. Sends confirmation

        On failure, automatically compensates all completed steps.
        """
        # Validate and enrich items from catalog
        enriched_items = []
        for item_request in request.items:
            product = await product_catalog.get(item_request["product_id"])
            if not product:
                raise HTTPException(
                    status_code=400,
                    detail=f"Product {item_request['product_id']} not found",
                )

            enriched_items.append(
                OrderItem(
                    product_id=product.id,
                    product_name=product.name,
                    quantity=item_request["quantity"],
                    unit_price=product.price,
                    sku=product.sku,
                )
            )

        # Create order
        order = Order(
            order_id=str(uuid7()),
            customer_id=str(request.customer_id),
            items=enriched_items,
            shipping_address=request.shipping_address,
            billing_address=request.billing_address,
        )

        await saga.order_repo.create(order)

        # Execute saga
        try:
            ctx = await saga.execute(order, request.payment_method_id)

            if ctx.status == SagaStatus.COMPLETED:
                return OrderResponse(
                    order_id=order.order_id,
                    saga_id=ctx.saga_id,
                    status="completed",
                    tracking_number=ctx.tracking_number,
                    total=order.total,
                    message="Order placed successfully",
                )
            else:
                return OrderResponse(
                    order_id=order.order_id,
                    saga_id=ctx.saga_id,
                    status="cancelled",
                    tracking_number=None,
                    total=Decimal("0"),
                    message="Order cancelled - payment or inventory issue",
                )

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Order processing failed: {str(e)}",
            )

    @router.get("/{order_id}")
    async def get_order(order_id: str) -> dict:
        """Get order details."""
        order = await saga.order_repo.get(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        return {
            "order_id": order.order_id,
            "status": order.status.value,
            "items": [
                {
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "quantity": item.quantity,
                    "unit_price": str(item.unit_price),
                    "total": str(item.total_price),
                }
                for item in order.items
            ],
            "total": str(order.total),
            "shipping_address": order.shipping_address,
            "created_at": order.created_at.isoformat(),
        }

    @router.get("/{order_id}/saga")
    async def get_order_saga(order_id: str) -> dict:
        """Get saga status for an order."""
        # Find saga by order (would need index in real impl)
        ctx = await saga.saga_repo.find_by_order(order_id)
        if not ctx:
            raise HTTPException(status_code=404, detail="Saga not found")

        return {
            "saga_id": ctx.saga_id,
            "status": ctx.status.value,
            "reservation_id": ctx.reservation_id,
            "payment_id": ctx.payment_id,
            "shipment_id": ctx.shipment_id,
            "tracking_number": ctx.tracking_number,
            "started_at": ctx.started_at.isoformat() if ctx.started_at else None,
            "completed_at": ctx.completed_at.isoformat() if ctx.completed_at else None,
        }

    return router


# -----------------------------------------------------------------------------
# Example Usage
# -----------------------------------------------------------------------------

"""
# Service implementations
inventory_service = InventoryServiceImpl(inventory_db)
payment_service = StripePaymentService(stripe_client)
shipping_service = ShippoShippingService(shippo_client)
notification_service = EmailNotificationService(sendgrid_client)
order_repository = PostgresOrderRepository(db_session)
saga_repository = PostgresSagaRepository(db_session)

# Create saga
saga = OrderFulfillmentSaga(
    inventory_service=inventory_service,
    payment_service=payment_service,
    shipping_service=shipping_service,
    notification_service=notification_service,
    order_repository=order_repository,
    saga_repository=saga_repository,
)

# Create router
router = create_order_router(saga, product_catalog)
app.include_router(router, prefix="/api/v1")

# API request example:
# POST /api/v1/orders/
# {
#     "customer_id": "550e8400-e29b-41d4-a716-446655440000",
#     "items": [
#         {"product_id": "prod-001", "quantity": 2},
#         {"product_id": "prod-002", "quantity": 1}
#     ],
#     "shipping_address": {
#         "street": "123 Main St",
#         "city": "San Francisco",
#         "state": "CA",
#         "zip": "94105",
#         "country": "US"
#     },
#     "billing_address": {
#         "street": "123 Main St",
#         "city": "San Francisco",
#         "state": "CA",
#         "zip": "94105",
#         "country": "US"
#     },
#     "payment_method_id": "pm_1234567890"
# }

# Response:
# {
#     "order_id": "019234ab-cdef-7890-1234-567890abcdef",
#     "saga_id": "019234ab-cdef-7890-1234-567890abcde0",
#     "status": "completed",
#     "tracking_number": "1Z999AA10123456784",
#     "total": "149.99",
#     "message": "Order placed successfully"
# }
"""
