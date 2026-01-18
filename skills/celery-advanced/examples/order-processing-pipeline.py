"""
Order Processing Pipeline Example

A complete e-commerce order processing workflow demonstrating:
- Chain for sequential processing steps
- Group for parallel inventory checks
- Chord for payment + fulfillment with aggregation
- Custom task states for progress tracking
- Error handling with compensation
- Idempotency with Redis deduplication

Flow:
    1. Validate Order
    2. Check Inventory (parallel for each item)
    3. Reserve Inventory
    4. Process Payment
    5. Create Fulfillment
    6. Send Notifications (parallel: email + SMS + push)
    7. Complete Order

Usage:
    from order_processing import submit_order
    result = submit_order(order_data)
    status = get_order_status(result.id)

Requirements:
    celery>=5.4.0
    redis>=5.0.0
    pydantic>=2.0.0
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from celery import Celery, chain, group, chord
from celery.exceptions import Reject
from celery.result import AsyncResult
from pydantic import BaseModel, Field
import redis
import structlog

# =============================================================================
# CONFIGURATION
# =============================================================================

logger = structlog.get_logger()

celery_app = Celery("orders")
celery_app.config_from_object("celery_config")

redis_client = redis.from_url(
    os.environ.get("REDIS_URL", "redis://localhost:6379/0")
)


# =============================================================================
# MODELS
# =============================================================================


class OrderStatus(str, Enum):
    PENDING = "pending"
    VALIDATING = "validating"
    CHECKING_INVENTORY = "checking_inventory"
    RESERVING_INVENTORY = "reserving_inventory"
    PROCESSING_PAYMENT = "processing_payment"
    CREATING_FULFILLMENT = "creating_fulfillment"
    NOTIFYING = "notifying"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class OrderItem(BaseModel):
    product_id: str
    sku: str
    quantity: int = Field(ge=1)
    unit_price: Decimal
    name: str


class Order(BaseModel):
    order_id: str = Field(default_factory=lambda: f"ord_{uuid4().hex[:12]}")
    customer_id: str
    items: list[OrderItem]
    shipping_address: dict
    billing_address: dict
    payment_method: dict
    total_amount: Decimal = Decimal("0")
    currency: str = "USD"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def model_post_init(self, __context: Any) -> None:
        if self.total_amount == 0:
            self.total_amount = sum(
                item.unit_price * item.quantity for item in self.items
            )


# =============================================================================
# IDEMPOTENCY
# =============================================================================


def idempotent_task(timeout: int = 3600):
    """
    Decorator for idempotent tasks using Redis deduplication.

    Prevents duplicate processing if task is retried or resubmitted.
    """

    def decorator(func):
        def wrapper(self, order_id: str, *args, **kwargs):
            lock_key = f"order_lock:{order_id}:{func.__name__}"

            # Try to acquire lock
            acquired = redis_client.set(lock_key, "1", nx=True, ex=timeout)

            if not acquired:
                # Check if already completed
                result_key = f"order_result:{order_id}:{func.__name__}"
                cached = redis_client.get(result_key)
                if cached:
                    logger.info(
                        "returning_cached_result",
                        order_id=order_id,
                        task=func.__name__,
                    )
                    import json

                    return json.loads(cached)

                # Still processing, skip
                logger.warning(
                    "task_already_processing",
                    order_id=order_id,
                    task=func.__name__,
                )
                raise Reject("Task already processing", requeue=False)

            try:
                result = func(self, order_id, *args, **kwargs)

                # Cache successful result
                result_key = f"order_result:{order_id}:{func.__name__}"
                import json

                redis_client.setex(result_key, timeout, json.dumps(result))

                return result

            except Exception:
                # Release lock on failure to allow retry
                redis_client.delete(lock_key)
                raise

        return wrapper

    return decorator


# =============================================================================
# ORDER TASKS
# =============================================================================


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def validate_order(self, order_data: dict) -> dict:
    """
    Step 1: Validate order data.

    Checks:
    - Required fields present
    - Items have valid SKUs
    - Payment method valid
    - Address deliverable
    """
    order_id = order_data["order_id"]

    self.update_state(
        state=OrderStatus.VALIDATING.value,
        meta={"order_id": order_id, "step": 1, "total_steps": 7},
    )

    log = logger.bind(order_id=order_id, task="validate_order")
    log.info("validating_order")

    try:
        # Validate with Pydantic
        order = Order(**order_data)

        # Validate items exist
        for item in order.items:
            if not _product_exists(item.product_id):
                raise ValueError(f"Product not found: {item.product_id}")

        # Validate payment method
        if not _validate_payment_method(order.payment_method):
            raise ValueError("Invalid payment method")

        # Validate address
        if not _validate_address(order.shipping_address):
            raise ValueError("Invalid shipping address")

        log.info("order_validated")

        return {
            "order_id": order_id,
            "order": order.model_dump(mode="json"),
            "validated": True,
        }

    except ValueError as e:
        log.error("validation_failed", error=str(e))
        raise Reject(f"Order validation failed: {e}", requeue=False)


@celery_app.task(bind=True)
def check_item_inventory(self, item_data: dict, order_id: str) -> dict:
    """
    Check inventory for a single item.

    Called in parallel for all order items.
    """
    log = logger.bind(
        order_id=order_id,
        product_id=item_data["product_id"],
        sku=item_data["sku"],
    )
    log.info("checking_inventory")

    available = _get_inventory_count(item_data["sku"])
    requested = item_data["quantity"]

    return {
        "sku": item_data["sku"],
        "product_id": item_data["product_id"],
        "requested": requested,
        "available": available,
        "sufficient": available >= requested,
    }


@celery_app.task(bind=True)
def aggregate_inventory_results(self, results: list[dict], order_data: dict) -> dict:
    """
    Aggregate inventory check results.

    Fails if any item has insufficient inventory.
    """
    order_id = order_data["order_id"]

    self.update_state(
        state=OrderStatus.CHECKING_INVENTORY.value,
        meta={"order_id": order_id, "step": 2, "total_steps": 7},
    )

    log = logger.bind(order_id=order_id)

    insufficient = [r for r in results if not r["sufficient"]]

    if insufficient:
        log.warning("insufficient_inventory", items=insufficient)
        raise Reject(
            f"Insufficient inventory for: {[i['sku'] for i in insufficient]}",
            requeue=False,
        )

    log.info("inventory_check_passed", items=len(results))

    return {
        "order_id": order_id,
        "order": order_data,
        "inventory_check": results,
    }


@celery_app.task(
    bind=True,
    max_retries=3,
    autoretry_for=(ConnectionError,),
    retry_backoff=True,
)
@idempotent_task(timeout=3600)
def reserve_inventory(self, order_id: str, inventory_data: dict) -> dict:
    """
    Step 3: Reserve inventory for the order.

    Creates soft-locks on inventory to prevent overselling.
    """
    self.update_state(
        state=OrderStatus.RESERVING_INVENTORY.value,
        meta={"order_id": order_id, "step": 3, "total_steps": 7},
    )

    log = logger.bind(order_id=order_id)
    log.info("reserving_inventory")

    reservations = []
    for check in inventory_data["inventory_check"]:
        reservation_id = _create_inventory_reservation(
            sku=check["sku"],
            quantity=check["requested"],
            order_id=order_id,
        )
        reservations.append(
            {
                "sku": check["sku"],
                "reservation_id": reservation_id,
                "quantity": check["requested"],
            }
        )

    log.info("inventory_reserved", reservations=len(reservations))

    return {
        "order_id": order_id,
        "order": inventory_data["order"],
        "reservations": reservations,
    }


@celery_app.task(
    bind=True,
    max_retries=5,
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=True,
    retry_backoff_max=300,
)
@idempotent_task(timeout=3600)
def process_payment(self, order_id: str, reservation_data: dict) -> dict:
    """
    Step 4: Process payment.

    Charges the customer's payment method.
    """
    self.update_state(
        state=OrderStatus.PROCESSING_PAYMENT.value,
        meta={"order_id": order_id, "step": 4, "total_steps": 7},
    )

    log = logger.bind(order_id=order_id)
    order = reservation_data["order"]

    log.info("processing_payment", amount=order["total_amount"])

    try:
        payment_result = _charge_payment(
            amount=Decimal(order["total_amount"]),
            currency=order["currency"],
            payment_method=order["payment_method"],
            order_id=order_id,
        )

        log.info(
            "payment_processed",
            transaction_id=payment_result["transaction_id"],
        )

        return {
            "order_id": order_id,
            "order": order,
            "reservations": reservation_data["reservations"],
            "payment": payment_result,
        }

    except PaymentDeclinedError as e:
        log.error("payment_declined", error=str(e))
        # Release inventory reservations
        _release_inventory_reservations(reservation_data["reservations"])
        raise Reject(f"Payment declined: {e}", requeue=False)


@celery_app.task(
    bind=True,
    max_retries=3,
    autoretry_for=(ConnectionError,),
    retry_backoff=True,
)
@idempotent_task(timeout=3600)
def create_fulfillment(self, order_id: str, payment_data: dict) -> dict:
    """
    Step 5: Create fulfillment record.

    Commits inventory reservations and creates shipment.
    """
    self.update_state(
        state=OrderStatus.CREATING_FULFILLMENT.value,
        meta={"order_id": order_id, "step": 5, "total_steps": 7},
    )

    log = logger.bind(order_id=order_id)
    log.info("creating_fulfillment")

    # Commit inventory reservations
    for reservation in payment_data["reservations"]:
        _commit_inventory_reservation(reservation["reservation_id"])

    # Create fulfillment
    fulfillment = _create_fulfillment_record(
        order_id=order_id,
        items=payment_data["order"]["items"],
        shipping_address=payment_data["order"]["shipping_address"],
    )

    log.info("fulfillment_created", fulfillment_id=fulfillment["fulfillment_id"])

    return {
        "order_id": order_id,
        "order": payment_data["order"],
        "payment": payment_data["payment"],
        "fulfillment": fulfillment,
    }


@celery_app.task(bind=True)
def send_order_email(self, notification_data: dict) -> dict:
    """Send order confirmation email."""
    order_id = notification_data["order_id"]
    customer_id = notification_data["order"]["customer_id"]

    log = logger.bind(order_id=order_id, customer_id=customer_id)
    log.info("sending_email_notification")

    _send_email(
        to=_get_customer_email(customer_id),
        template="order_confirmation",
        data={
            "order_id": order_id,
            "items": notification_data["order"]["items"],
            "total": notification_data["order"]["total_amount"],
            "fulfillment_id": notification_data["fulfillment"]["fulfillment_id"],
        },
    )

    return {"channel": "email", "sent": True, "order_id": order_id}


@celery_app.task(bind=True)
def send_order_sms(self, notification_data: dict) -> dict:
    """Send order confirmation SMS."""
    order_id = notification_data["order_id"]
    customer_id = notification_data["order"]["customer_id"]

    log = logger.bind(order_id=order_id, customer_id=customer_id)
    log.info("sending_sms_notification")

    _send_sms(
        to=_get_customer_phone(customer_id),
        message=f"Order {order_id} confirmed! Track at example.com/orders/{order_id}",
    )

    return {"channel": "sms", "sent": True, "order_id": order_id}


@celery_app.task(bind=True)
def send_order_push(self, notification_data: dict) -> dict:
    """Send order confirmation push notification."""
    order_id = notification_data["order_id"]
    customer_id = notification_data["order"]["customer_id"]

    log = logger.bind(order_id=order_id, customer_id=customer_id)
    log.info("sending_push_notification")

    _send_push(
        user_id=customer_id,
        title="Order Confirmed",
        body=f"Your order {order_id} is being processed",
    )

    return {"channel": "push", "sent": True, "order_id": order_id}


@celery_app.task(bind=True)
def aggregate_notifications(self, results: list[dict], fulfillment_data: dict) -> dict:
    """Aggregate notification results and complete order."""
    order_id = fulfillment_data["order_id"]

    log = logger.bind(order_id=order_id)
    log.info("notifications_sent", channels=[r["channel"] for r in results])

    return {
        "order_id": order_id,
        "order": fulfillment_data["order"],
        "payment": fulfillment_data["payment"],
        "fulfillment": fulfillment_data["fulfillment"],
        "notifications": results,
    }


@celery_app.task(bind=True)
def complete_order(self, order_id: str, final_data: dict) -> dict:
    """
    Step 7: Mark order as complete.

    Final step - updates order status and triggers analytics.
    """
    log = logger.bind(order_id=order_id)
    log.info("completing_order")

    # Update order status in database
    _update_order_status(order_id, OrderStatus.COMPLETED)

    # Track analytics
    _track_order_completed(
        order_id=order_id,
        total=final_data["order"]["total_amount"],
        items=len(final_data["order"]["items"]),
    )

    log.info("order_completed")

    return {
        "order_id": order_id,
        "status": OrderStatus.COMPLETED.value,
        "payment_transaction_id": final_data["payment"]["transaction_id"],
        "fulfillment_id": final_data["fulfillment"]["fulfillment_id"],
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }


# =============================================================================
# ERROR HANDLING
# =============================================================================


@celery_app.task
def handle_order_error(request, exc, traceback, order_id: str) -> None:
    """
    Error callback for order processing failures.

    Performs compensation actions and alerts.
    """
    logger.error(
        "order_processing_failed",
        order_id=order_id,
        error=str(exc),
        task_id=request.id,
    )

    # Update order status
    _update_order_status(order_id, OrderStatus.FAILED)

    # Store failure for review
    _store_order_failure(
        order_id=order_id,
        error=str(exc),
        traceback=traceback,
    )

    # Send alert
    _send_alert(
        f"Order {order_id} failed: {exc}",
        severity="error",
        details={"order_id": order_id, "task_id": request.id},
    )


# =============================================================================
# PIPELINE ORCHESTRATION
# =============================================================================


def submit_order(order_data: dict) -> AsyncResult:
    """
    Submit order for processing.

    Creates and executes the full order processing pipeline.

    Args:
        order_data: Order data dictionary

    Returns:
        AsyncResult for tracking the pipeline

    Example:
        result = submit_order({
            "customer_id": "cust-123",
            "items": [
                {
                    "product_id": "prod-1",
                    "sku": "SKU-001",
                    "quantity": 2,
                    "unit_price": "29.99",
                    "name": "Widget"
                }
            ],
            "shipping_address": {"city": "NY", ...},
            "billing_address": {"city": "NY", ...},
            "payment_method": {"type": "card", "token": "tok_xxx"}
        })

        # Check status
        status = get_order_status(result.id)
    """
    # Generate order ID if not provided
    if "order_id" not in order_data:
        order_data["order_id"] = f"ord_{uuid4().hex[:12]}"

    order_id = order_data["order_id"]

    logger.info("submitting_order", order_id=order_id)

    # Build pipeline
    pipeline = chain(
        # Step 1: Validate
        validate_order.s(order_data),
        # Step 2: Check inventory in parallel
        _inventory_check_chord.s(),
        # Step 3: Reserve inventory
        _reserve_inventory_step.s(),
        # Step 4: Process payment
        _process_payment_step.s(),
        # Step 5: Create fulfillment
        _create_fulfillment_step.s(),
        # Step 6: Send notifications in parallel
        _notifications_chord.s(),
        # Step 7: Complete order
        complete_order.si(order_id),
    )

    return pipeline.apply_async(
        link_error=handle_order_error.s(order_id=order_id),
        queue="high",
        priority=7,
    )


@celery_app.task(bind=True)
def _inventory_check_chord(self, validation_result: dict) -> dict:
    """Execute parallel inventory checks with aggregation.

    Uses self.replace() to avoid blocking - the chord replaces this task
    and its callback's return value becomes the result.
    """
    order = validation_result["order"]
    order_id = validation_result["order_id"]

    workflow = chord(
        [
            check_item_inventory.s(
                item_data=item,
                order_id=order_id,
            )
            for item in order["items"]
        ],
        aggregate_inventory_results.s(order_data=order),
    )

    # Replace this task with the chord - non-blocking pattern
    raise self.replace(workflow)


@celery_app.task(bind=True)
def _reserve_inventory_step(self, inventory_data: dict) -> dict:
    """Reserve inventory step.

    Uses self.replace() to delegate to the actual task without blocking.
    """
    raise self.replace(
        reserve_inventory.s(inventory_data["order_id"], inventory_data)
    )


@celery_app.task(bind=True)
def _process_payment_step(self, reservation_data: dict) -> dict:
    """Process payment step.

    Uses self.replace() to delegate to the actual task without blocking.
    """
    raise self.replace(
        process_payment.s(reservation_data["order_id"], reservation_data)
    )


@celery_app.task(bind=True)
def _create_fulfillment_step(self, payment_data: dict) -> dict:
    """Create fulfillment step.

    Uses self.replace() to delegate to the actual task without blocking.
    """
    raise self.replace(
        create_fulfillment.s(payment_data["order_id"], payment_data)
    )


@celery_app.task(bind=True)
def _notifications_chord(self, fulfillment_data: dict) -> dict:
    """Send notifications in parallel with aggregation.

    Uses self.replace() to avoid blocking - the chord replaces this task
    and its callback's return value becomes the result.
    """
    workflow = chord(
        [
            send_order_email.s(fulfillment_data),
            send_order_sms.s(fulfillment_data),
            send_order_push.s(fulfillment_data),
        ],
        aggregate_notifications.s(fulfillment_data=fulfillment_data),
    )

    # Replace this task with the chord - non-blocking pattern
    raise self.replace(workflow)


# =============================================================================
# STATUS TRACKING
# =============================================================================


def get_order_status(task_id: str) -> dict:
    """
    Get current status of order processing.

    Args:
        task_id: Root task ID from submit_order

    Returns:
        Status dictionary with state and progress
    """
    result = AsyncResult(task_id)

    return {
        "task_id": task_id,
        "state": result.state,
        "info": result.info if result.info else {},
        "ready": result.ready(),
        "successful": result.successful() if result.ready() else None,
        "result": result.get() if result.successful() else None,
    }


def cancel_order(order_id: str, task_id: str) -> bool:
    """
    Cancel a pending order.

    Only works if order hasn't started payment processing.
    """
    result = AsyncResult(task_id)

    # Check if cancellable
    if result.state in (
        OrderStatus.PROCESSING_PAYMENT.value,
        OrderStatus.COMPLETED.value,
    ):
        return False

    result.revoke(terminate=True)
    _update_order_status(order_id, OrderStatus.CANCELLED)

    return True


# =============================================================================
# HELPER FUNCTIONS (Replace with actual implementations)
# =============================================================================


def _product_exists(product_id: str) -> bool:
    """Check if product exists."""
    return True  # Replace with DB lookup


def _validate_payment_method(payment_method: dict) -> bool:
    """Validate payment method."""
    return True  # Replace with payment provider validation


def _validate_address(address: dict) -> bool:
    """Validate shipping address."""
    return True  # Replace with address validation service


def _get_inventory_count(sku: str) -> int:
    """Get available inventory count."""
    return 100  # Replace with inventory service call


def _create_inventory_reservation(
    sku: str, quantity: int, order_id: str
) -> str:
    """Create inventory reservation."""
    return f"res_{uuid4().hex[:8]}"  # Replace with inventory service


def _commit_inventory_reservation(reservation_id: str) -> None:
    """Commit inventory reservation."""
    pass  # Replace with inventory service


def _release_inventory_reservations(reservations: list[dict]) -> None:
    """Release inventory reservations."""
    pass  # Replace with inventory service


def _charge_payment(
    amount: Decimal,
    currency: str,
    payment_method: dict,
    order_id: str,
) -> dict:
    """Charge payment method."""
    return {
        "transaction_id": f"txn_{uuid4().hex[:12]}",
        "amount": str(amount),
        "currency": currency,
        "status": "captured",
    }


def _create_fulfillment_record(
    order_id: str,
    items: list[dict],
    shipping_address: dict,
) -> dict:
    """Create fulfillment record."""
    return {
        "fulfillment_id": f"ful_{uuid4().hex[:8]}",
        "order_id": order_id,
        "status": "pending",
    }


def _get_customer_email(customer_id: str) -> str:
    """Get customer email."""
    return f"{customer_id}@example.com"


def _get_customer_phone(customer_id: str) -> str:
    """Get customer phone."""
    return "+1234567890"


def _send_email(to: str, template: str, data: dict) -> None:
    """Send email."""
    pass


def _send_sms(to: str, message: str) -> None:
    """Send SMS."""
    pass


def _send_push(user_id: str, title: str, body: str) -> None:
    """Send push notification."""
    pass


def _update_order_status(order_id: str, status: OrderStatus) -> None:
    """Update order status in database."""
    pass


def _store_order_failure(
    order_id: str, error: str, traceback: str
) -> None:
    """Store order failure for review."""
    pass


def _send_alert(message: str, severity: str, details: dict) -> None:
    """Send alert notification."""
    pass


def _track_order_completed(
    order_id: str, total: Decimal, items: int
) -> None:
    """Track completed order analytics."""
    pass


class PaymentDeclinedError(Exception):
    """Payment was declined."""

    pass
