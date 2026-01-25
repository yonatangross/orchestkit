# Order Fulfillment Saga Example
# Complete implementation of a production-ready order saga with Temporal

"""
Order Fulfillment Saga

This example demonstrates a complete order fulfillment process using the saga pattern:

1. Validate Order      -> No compensation (read-only)
2. Reserve Inventory   -> Release Inventory
3. Process Payment     -> Refund Payment
4. Create Shipment     -> Cancel Shipment
5. Send Confirmation   -> No compensation (notification)

Key features:
- Automatic compensation on failure
- Idempotent operations
- Structured error handling
- Query and signal support
- Production-ready patterns
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from temporalio import activity, workflow
from temporalio.client import Client
from temporalio.common import RetryPolicy
from temporalio.exceptions import ApplicationError
from temporalio.worker import Worker

# ============================================================================
# Domain Models
# ============================================================================


class OrderStatus(str, Enum):
    PENDING = "pending"
    VALIDATING = "validating"
    RESERVING_INVENTORY = "reserving_inventory"
    PROCESSING_PAYMENT = "processing_payment"
    CREATING_SHIPMENT = "creating_shipment"
    SENDING_CONFIRMATION = "sending_confirmation"
    COMPLETED = "completed"
    COMPENSATING = "compensating"
    FAILED = "failed"


@dataclass
class OrderItem:
    sku: str
    quantity: int
    unit_price: Decimal


@dataclass
class Address:
    street: str
    city: str
    state: str
    postal_code: str
    country: str


@dataclass
class OrderInput:
    """Input for the order fulfillment workflow."""
    order_id: str
    customer_id: str
    items: list[OrderItem]
    shipping_address: Address
    billing_address: Address
    idempotency_key: str  # For payment idempotency


@dataclass
class OrderResult:
    """Result of the order fulfillment workflow."""
    order_id: str
    status: str
    reservation_id: str | None = None
    payment_id: str | None = None
    shipment_id: str | None = None
    tracking_number: str | None = None
    completed_at: datetime | None = None
    error: str | None = None


# Activity inputs/outputs
@dataclass
class ValidationResult:
    valid: bool
    total_amount: Decimal
    errors: list[str] = field(default_factory=list)


@dataclass
class ReservationResult:
    reservation_id: str
    items_reserved: int
    warehouse_id: str


@dataclass
class PaymentResult:
    payment_id: str
    amount: Decimal
    status: str
    transaction_id: str


@dataclass
class ShipmentResult:
    shipment_id: str
    tracking_number: str
    carrier: str
    estimated_delivery: datetime


# ============================================================================
# Activities
# ============================================================================


@activity.defn
async def validate_order(order: OrderInput) -> ValidationResult:
    """
    Validate order details.
    No compensation needed - read-only operation.
    """
    activity.logger.info(f"Validating order {order.order_id}")
    errors = []

    # Validate items
    if not order.items:
        errors.append("Order must have at least one item")

    for item in order.items:
        if item.quantity <= 0:
            errors.append(f"Invalid quantity for {item.sku}")
        if item.unit_price <= 0:
            errors.append(f"Invalid price for {item.sku}")

    # Calculate total
    total = sum(
        item.unit_price * item.quantity
        for item in order.items
    )

    if total <= 0:
        errors.append("Order total must be positive")

    # Validate addresses
    if not order.shipping_address.postal_code:
        errors.append("Shipping postal code is required")

    return ValidationResult(
        valid=len(errors) == 0,
        total_amount=total,
        errors=errors,
    )


@activity.defn
async def reserve_inventory(order: OrderInput) -> ReservationResult:
    """
    Reserve inventory for order items.
    Compensation: release_inventory
    """
    activity.logger.info(f"Reserving inventory for order {order.order_id}")

    # Simulate inventory API call
    # In production: call inventory service with idempotency key
    await asyncio.sleep(0.5)

    # Simulate occasional failures for testing
    # import random
    # if random.random() < 0.1:
    #     raise ApplicationError("Inventory service unavailable", non_retryable=False)

    return ReservationResult(
        reservation_id=f"res-{order.order_id}",
        items_reserved=len(order.items),
        warehouse_id="WH-001",
    )


@activity.defn
async def release_inventory(reservation_id: str) -> None:
    """
    Compensate: Release reserved inventory.
    Must be idempotent - safe to call multiple times.
    """
    activity.logger.info(f"Releasing inventory reservation {reservation_id}")

    # Simulate release API call
    await asyncio.sleep(0.2)

    # Idempotent: releasing non-existent reservation is a no-op
    activity.logger.info(f"Inventory released: {reservation_id}")


@activity.defn
async def process_payment(
    order: OrderInput,
    amount: Decimal,
) -> PaymentResult:
    """
    Process customer payment.
    Compensation: refund_payment

    Uses idempotency_key to prevent duplicate charges on retry.
    """
    activity.logger.info(
        f"Processing payment for order {order.order_id}, amount: {amount}"
    )

    # Simulate payment API call with idempotency key
    await asyncio.sleep(1.0)

    # Example: simulate payment declined
    # if amount > 1000:
    #     raise ApplicationError(
    #         "Payment declined: insufficient funds",
    #         non_retryable=True,
    #         type="PaymentDeclined",
    #     )

    return PaymentResult(
        payment_id=f"pay-{order.order_id}",
        amount=amount,
        status="captured",
        transaction_id=f"txn-{order.idempotency_key}",
    )


@activity.defn
async def refund_payment(payment_id: str, amount: Decimal) -> None:
    """
    Compensate: Refund payment.
    Must be idempotent - safe to call multiple times.
    """
    activity.logger.info(f"Refunding payment {payment_id}, amount: {amount}")

    # Simulate refund API call
    await asyncio.sleep(0.5)

    # Idempotent: refunding already-refunded payment is a no-op
    activity.logger.info(f"Payment refunded: {payment_id}")


@activity.defn
async def create_shipment(
    order: OrderInput,
    reservation_id: str,
) -> ShipmentResult:
    """
    Create shipment for the order.
    Compensation: cancel_shipment
    """
    activity.logger.info(f"Creating shipment for order {order.order_id}")

    # Simulate shipping API call
    await asyncio.sleep(0.5)

    return ShipmentResult(
        shipment_id=f"ship-{order.order_id}",
        tracking_number=f"TRK-{order.order_id}-001",
        carrier="FedEx",
        estimated_delivery=datetime.now(timezone.utc) + timedelta(days=3),
    )


@activity.defn
async def cancel_shipment(shipment_id: str) -> None:
    """
    Compensate: Cancel shipment.
    Must be idempotent - safe to call multiple times.
    """
    activity.logger.info(f"Cancelling shipment {shipment_id}")

    # Simulate cancel API call
    await asyncio.sleep(0.2)

    # Idempotent: cancelling already-cancelled shipment is a no-op
    activity.logger.info(f"Shipment cancelled: {shipment_id}")


@activity.defn
async def send_order_confirmation(
    order: OrderInput,
    payment: PaymentResult,
    shipment: ShipmentResult,
) -> dict:
    """
    Send order confirmation email.
    No compensation needed - notification is best-effort.
    """
    activity.logger.info(f"Sending confirmation for order {order.order_id}")

    # Simulate email send
    await asyncio.sleep(0.2)

    return {
        "notification_id": f"notif-{order.order_id}",
        "sent_to": f"customer-{order.customer_id}@example.com",
        "tracking_number": shipment.tracking_number,
    }


# ============================================================================
# Workflow
# ============================================================================


@workflow.defn
class OrderFulfillmentWorkflow:
    """
    Order fulfillment saga workflow.

    Orchestrates the complete order fulfillment process with
    automatic compensation on failure.
    """

    def __init__(self):
        self._status = OrderStatus.PENDING
        self._order: OrderInput | None = None
        self._validation: ValidationResult | None = None
        self._reservation: ReservationResult | None = None
        self._payment: PaymentResult | None = None
        self._shipment: ShipmentResult | None = None
        self._error: str | None = None
        self._compensations: list[tuple[str, Any]] = []

    @workflow.run
    async def run(self, order: OrderInput) -> OrderResult:
        """Execute the order fulfillment saga."""
        self._order = order
        workflow.logger.info(f"Starting order fulfillment: {order.order_id}")

        try:
            # Step 1: Validate order (no compensation)
            self._status = OrderStatus.VALIDATING
            self._validation = await workflow.execute_activity(
                validate_order,
                order,
                start_to_close_timeout=timedelta(seconds=30),
            )

            if not self._validation.valid:
                raise ApplicationError(
                    f"Order validation failed: {self._validation.errors}",
                    non_retryable=True,
                    type="ValidationFailed",
                )

            # Step 2: Reserve inventory
            self._status = OrderStatus.RESERVING_INVENTORY
            self._reservation = await workflow.execute_activity(
                reserve_inventory,
                order,
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(
                    maximum_attempts=3,
                    initial_interval=timedelta(seconds=1),
                ),
            )
            # Register compensation
            self._compensations.append(
                ("release_inventory", self._reservation.reservation_id)
            )

            # Step 3: Process payment
            self._status = OrderStatus.PROCESSING_PAYMENT
            self._payment = await workflow.execute_activity(
                process_payment,
                args=[order, self._validation.total_amount],
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=RetryPolicy(
                    maximum_attempts=3,
                    initial_interval=timedelta(seconds=2),
                    non_retryable_error_types=["PaymentDeclined"],
                ),
            )
            # Register compensation
            self._compensations.append(
                ("refund_payment", (self._payment.payment_id, self._payment.amount))
            )

            # Step 4: Create shipment
            self._status = OrderStatus.CREATING_SHIPMENT
            self._shipment = await workflow.execute_activity(
                create_shipment,
                args=[order, self._reservation.reservation_id],
                start_to_close_timeout=timedelta(minutes=3),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
            # Register compensation
            self._compensations.append(
                ("cancel_shipment", self._shipment.shipment_id)
            )

            # Step 5: Send confirmation (no compensation)
            self._status = OrderStatus.SENDING_CONFIRMATION
            await workflow.execute_activity(
                send_order_confirmation,
                args=[order, self._payment, self._shipment],
                start_to_close_timeout=timedelta(minutes=1),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )

            # Success!
            self._status = OrderStatus.COMPLETED
            workflow.logger.info(f"Order completed: {order.order_id}")

            return OrderResult(
                order_id=order.order_id,
                status="completed",
                reservation_id=self._reservation.reservation_id,
                payment_id=self._payment.payment_id,
                shipment_id=self._shipment.shipment_id,
                tracking_number=self._shipment.tracking_number,
                completed_at=workflow.now(),
            )

        except Exception as e:
            self._error = str(e)
            self._status = OrderStatus.COMPENSATING

            workflow.logger.warning(
                f"Order {order.order_id} failed, running "
                f"{len(self._compensations)} compensations: {e}"
            )

            # Run compensations in reverse order
            await self._run_compensations()

            self._status = OrderStatus.FAILED

            return OrderResult(
                order_id=order.order_id,
                status="failed",
                reservation_id=self._reservation.reservation_id if self._reservation else None,
                payment_id=self._payment.payment_id if self._payment else None,
                shipment_id=self._shipment.shipment_id if self._shipment else None,
                error=str(e),
            )

    async def _run_compensations(self):
        """Run all registered compensations in reverse order."""
        for compensation_name, compensation_args in reversed(self._compensations):
            try:
                workflow.logger.info(f"Running compensation: {compensation_name}")

                if compensation_name == "release_inventory":
                    await workflow.execute_activity(
                        release_inventory,
                        compensation_args,
                        start_to_close_timeout=timedelta(minutes=2),
                        retry_policy=RetryPolicy(maximum_attempts=5),
                    )
                elif compensation_name == "refund_payment":
                    payment_id, amount = compensation_args
                    await workflow.execute_activity(
                        refund_payment,
                        args=[payment_id, amount],
                        start_to_close_timeout=timedelta(minutes=5),
                        retry_policy=RetryPolicy(maximum_attempts=5),
                    )
                elif compensation_name == "cancel_shipment":
                    await workflow.execute_activity(
                        cancel_shipment,
                        compensation_args,
                        start_to_close_timeout=timedelta(minutes=2),
                        retry_policy=RetryPolicy(maximum_attempts=5),
                    )

            except Exception as comp_error:
                # Log but continue with other compensations
                workflow.logger.error(
                    f"Compensation {compensation_name} failed: {comp_error}. "
                    "Manual intervention required."
                )

    # =========================================================================
    # Queries - Read workflow state
    # =========================================================================

    @workflow.query
    def get_status(self) -> str:
        """Get current order status."""
        return self._status.value

    @workflow.query
    def get_order_details(self) -> dict:
        """Get full order details."""
        return {
            "order_id": self._order.order_id if self._order else None,
            "status": self._status.value,
            "total_amount": str(self._validation.total_amount) if self._validation else None,
            "reservation_id": self._reservation.reservation_id if self._reservation else None,
            "payment_id": self._payment.payment_id if self._payment else None,
            "shipment_id": self._shipment.shipment_id if self._shipment else None,
            "tracking_number": self._shipment.tracking_number if self._shipment else None,
            "error": self._error,
        }

    # =========================================================================
    # Signals - External input to workflow
    # =========================================================================

    @workflow.signal
    async def expedite_shipping(self):
        """
        Signal to expedite shipping.
        Only valid before shipment is created.
        """
        if self._shipment:
            workflow.logger.warning("Cannot expedite - already shipped")
            return

        workflow.logger.info("Expedite shipping requested")
        # In production: set a flag that create_shipment reads


# ============================================================================
# Client Usage Example
# ============================================================================


async def example_usage():
    """Example: Starting and monitoring order workflow."""

    # Connect to Temporal
    client = await Client.connect("localhost:7233")

    # Create order input
    order = OrderInput(
        order_id="ORD-12345",
        customer_id="CUST-001",
        items=[
            OrderItem(sku="SKU-001", quantity=2, unit_price=Decimal("29.99")),
            OrderItem(sku="SKU-002", quantity=1, unit_price=Decimal("49.99")),
        ],
        shipping_address=Address(
            street="123 Main St",
            city="San Francisco",
            state="CA",
            postal_code="94105",
            country="US",
        ),
        billing_address=Address(
            street="123 Main St",
            city="San Francisco",
            state="CA",
            postal_code="94105",
            country="US",
        ),
        idempotency_key="idem-ORD-12345-v1",
    )

    # Start workflow
    handle = await client.start_workflow(
        OrderFulfillmentWorkflow.run,
        order,
        id=f"order-{order.order_id}",
        task_queue="order-processing",
    )

    print(f"Started workflow: {handle.id}")

    # Query status while running
    await asyncio.sleep(1)
    status = await handle.query(OrderFulfillmentWorkflow.get_status)
    print(f"Current status: {status}")

    # Wait for completion
    result = await handle.result()
    print(f"Order completed: {result}")

    return result


# ============================================================================
# Worker Setup
# ============================================================================


async def run_worker():
    """Run the order fulfillment worker."""
    client = await Client.connect("localhost:7233")

    worker = Worker(
        client,
        task_queue="order-processing",
        workflows=[OrderFulfillmentWorkflow],
        activities=[
            validate_order,
            reserve_inventory,
            release_inventory,
            process_payment,
            refund_payment,
            create_shipment,
            cancel_shipment,
            send_order_confirmation,
        ],
    )

    print("Starting order fulfillment worker...")
    await worker.run()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "client":
        asyncio.run(example_usage())
    else:
        asyncio.run(run_worker())
