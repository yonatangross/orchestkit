# Subscription Billing Workflow Example
# Recurring billing with Temporal - production patterns

"""
Subscription Billing Workflow

This example demonstrates a production-ready recurring billing system:

1. Subscription lifecycle management (create, pause, resume, cancel)
2. Recurring billing with retry and grace period
3. Dunning process for failed payments
4. Proration for plan changes
5. Usage-based billing aggregation

Key features:
- Long-running workflow (months/years)
- Continue-as-new for history management
- Signals for lifecycle events
- Queries for subscription status
- Durable timers for billing cycles
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from typing import Any

from temporalio import activity, workflow
from temporalio.client import Client
from temporalio.common import RetryPolicy
from temporalio.exceptions import ApplicationError
from temporalio.worker import Worker

# ============================================================================
# Domain Models
# ============================================================================


class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class BillingInterval(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


@dataclass
class Plan:
    plan_id: str
    name: str
    amount: Decimal
    interval: BillingInterval
    trial_days: int = 0


@dataclass
class SubscriptionInput:
    """Input for creating a subscription."""
    subscription_id: str
    customer_id: str
    plan: Plan
    payment_method_id: str
    start_date: datetime | None = None  # None = start immediately


@dataclass
class SubscriptionState:
    """Current state of a subscription."""
    subscription_id: str
    customer_id: str
    plan: Plan
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime
    payment_method_id: str
    billing_cycle_count: int = 0
    failed_payment_attempts: int = 0
    last_payment_date: datetime | None = None
    cancelled_at: datetime | None = None
    pause_start: datetime | None = None
    metadata: dict = field(default_factory=dict)


@dataclass
class InvoiceResult:
    invoice_id: str
    amount: Decimal
    status: str  # "paid", "failed", "pending"
    payment_id: str | None = None
    error: str | None = None


@dataclass
class UsageRecord:
    """Usage-based billing record."""
    subscription_id: str
    metric: str
    quantity: int
    unit_price: Decimal
    recorded_at: datetime


# ============================================================================
# Activities
# ============================================================================


@activity.defn
async def create_invoice(
    subscription_id: str,
    customer_id: str,
    amount: Decimal,
    period_start: datetime,
    period_end: datetime,
    line_items: list[dict] | None = None,
) -> str:
    """Create an invoice for the billing period."""
    activity.logger.info(
        f"Creating invoice for subscription {subscription_id}, amount: {amount}"
    )

    # Simulate invoice creation in billing system
    await asyncio.sleep(0.2)

    invoice_id = f"inv-{subscription_id}-{period_start.strftime('%Y%m%d')}"
    activity.logger.info(f"Invoice created: {invoice_id}")

    return invoice_id


@activity.defn
async def charge_payment(
    invoice_id: str,
    payment_method_id: str,
    amount: Decimal,
    idempotency_key: str,
) -> InvoiceResult:
    """Attempt to charge the customer's payment method."""
    activity.logger.info(
        f"Charging payment method {payment_method_id} for invoice {invoice_id}"
    )

    # Simulate payment processing
    await asyncio.sleep(0.5)

    # Simulate occasional payment failures for testing dunning
    # import random
    # if random.random() < 0.2:
    #     return InvoiceResult(
    #         invoice_id=invoice_id,
    #         amount=amount,
    #         status="failed",
    #         error="Card declined",
    #     )

    return InvoiceResult(
        invoice_id=invoice_id,
        amount=amount,
        status="paid",
        payment_id=f"pay-{invoice_id}",
    )


@activity.defn
async def send_payment_failed_notification(
    customer_id: str,
    invoice_id: str,
    attempt_number: int,
    next_retry_date: datetime | None,
) -> None:
    """Notify customer of failed payment."""
    activity.logger.info(
        f"Sending payment failed notification to {customer_id}, "
        f"attempt {attempt_number}"
    )

    # Simulate email/SMS notification
    await asyncio.sleep(0.1)


@activity.defn
async def send_subscription_cancelled_notification(
    customer_id: str,
    subscription_id: str,
    reason: str,
) -> None:
    """Notify customer of subscription cancellation."""
    activity.logger.info(
        f"Sending cancellation notification to {customer_id}: {reason}"
    )
    await asyncio.sleep(0.1)


@activity.defn
async def get_usage_records(
    subscription_id: str,
    period_start: datetime,
    period_end: datetime,
) -> list[UsageRecord]:
    """Fetch usage records for usage-based billing."""
    activity.logger.info(
        f"Fetching usage for {subscription_id} from {period_start} to {period_end}"
    )

    # Simulate fetching from usage tracking system
    await asyncio.sleep(0.2)

    # Example usage records
    return [
        UsageRecord(
            subscription_id=subscription_id,
            metric="api_calls",
            quantity=1500,
            unit_price=Decimal("0.001"),
            recorded_at=period_start + timedelta(days=15),
        ),
        UsageRecord(
            subscription_id=subscription_id,
            metric="storage_gb",
            quantity=25,
            unit_price=Decimal("0.10"),
            recorded_at=period_start + timedelta(days=15),
        ),
    ]


@activity.defn
async def calculate_proration(
    old_plan: Plan,
    new_plan: Plan,
    days_remaining: int,
    total_days: int,
) -> Decimal:
    """Calculate proration amount for plan change."""
    activity.logger.info(
        f"Calculating proration: {old_plan.name} -> {new_plan.name}"
    )

    # Credit for unused time on old plan
    old_daily_rate = old_plan.amount / Decimal(total_days)
    credit = old_daily_rate * days_remaining

    # Charge for remaining time on new plan
    new_daily_rate = new_plan.amount / Decimal(total_days)
    charge = new_daily_rate * days_remaining

    proration = charge - credit

    activity.logger.info(f"Proration amount: {proration}")
    return proration


@activity.defn
async def update_subscription_in_database(state: SubscriptionState) -> None:
    """Persist subscription state to database."""
    activity.logger.info(f"Updating subscription {state.subscription_id} in database")
    await asyncio.sleep(0.1)


# ============================================================================
# Billing Workflow
# ============================================================================


@workflow.defn
class SubscriptionBillingWorkflow:
    """
    Long-running subscription billing workflow.

    Handles:
    - Recurring billing cycles
    - Payment retries (dunning)
    - Subscription lifecycle (pause, resume, cancel)
    - Plan changes with proration
    - Usage-based billing
    """

    # Configuration
    MAX_PAYMENT_ATTEMPTS = 4
    PAYMENT_RETRY_INTERVALS = [
        timedelta(days=3),
        timedelta(days=5),
        timedelta(days=7),
    ]
    GRACE_PERIOD_DAYS = 14
    MAX_BILLING_CYCLES_BEFORE_CONTINUE_AS_NEW = 12  # ~1 year for monthly

    def __init__(self):
        self._state: SubscriptionState | None = None
        self._pending_plan_change: Plan | None = None
        self._cancel_requested = False
        self._pause_requested = False
        self._resume_requested = False

    @workflow.run
    async def run(self, input: SubscriptionInput) -> dict:
        """
        Main subscription billing loop.

        Runs until subscription is cancelled or expires.
        Uses continue-as-new to manage history size.
        """
        # Initialize state
        now = workflow.now()
        period_start = input.start_date or now
        period_end = self._calculate_period_end(period_start, input.plan.interval)

        self._state = SubscriptionState(
            subscription_id=input.subscription_id,
            customer_id=input.customer_id,
            plan=input.plan,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=period_start,
            current_period_end=period_end,
            payment_method_id=input.payment_method_id,
        )

        workflow.logger.info(
            f"Starting subscription {input.subscription_id} for {input.customer_id}"
        )

        # Handle trial period
        if input.plan.trial_days > 0:
            workflow.logger.info(f"Trial period: {input.plan.trial_days} days")
            trial_end = period_start + timedelta(days=input.plan.trial_days)
            await self._wait_until(trial_end)

        # Main billing loop
        while self._state.status == SubscriptionStatus.ACTIVE:
            # Check for continue-as-new
            if self._state.billing_cycle_count >= self.MAX_BILLING_CYCLES_BEFORE_CONTINUE_AS_NEW:
                workflow.logger.info("Continuing as new workflow")
                workflow.continue_as_new(self._create_continuation_input())

            # Wait for billing date
            await self._wait_until(self._state.current_period_end)

            # Check if cancelled or paused during wait
            if self._cancel_requested:
                await self._handle_cancellation("customer_requested")
                break

            if self._pause_requested:
                await self._handle_pause()
                continue

            # Handle pending plan change
            if self._pending_plan_change:
                await self._apply_plan_change()

            # Bill the customer
            success = await self._process_billing_cycle()

            if not success:
                # Dunning failed - cancel subscription
                await self._handle_cancellation("payment_failed")
                break

            # Advance to next period
            self._advance_period()

        # Persist final state
        await workflow.execute_activity(
            update_subscription_in_database,
            self._state,
            start_to_close_timeout=timedelta(seconds=30),
        )

        return {
            "subscription_id": self._state.subscription_id,
            "final_status": self._state.status.value,
            "billing_cycles": self._state.billing_cycle_count,
            "cancelled_at": self._state.cancelled_at.isoformat() if self._state.cancelled_at else None,
        }

    async def _process_billing_cycle(self) -> bool:
        """
        Process a single billing cycle.
        Returns True if payment succeeded, False if all retries exhausted.
        """
        workflow.logger.info(
            f"Processing billing cycle {self._state.billing_cycle_count + 1}"
        )

        # Get usage-based charges
        usage_records = await workflow.execute_activity(
            get_usage_records,
            args=[
                self._state.subscription_id,
                self._state.current_period_start,
                self._state.current_period_end,
            ],
            start_to_close_timeout=timedelta(minutes=2),
        )

        # Calculate total amount
        base_amount = self._state.plan.amount
        usage_amount = sum(
            r.quantity * r.unit_price for r in usage_records
        )
        total_amount = base_amount + usage_amount

        # Create invoice
        invoice_id = await workflow.execute_activity(
            create_invoice,
            args=[
                self._state.subscription_id,
                self._state.customer_id,
                total_amount,
                self._state.current_period_start,
                self._state.current_period_end,
                [{"metric": r.metric, "quantity": r.quantity} for r in usage_records],
            ],
            start_to_close_timeout=timedelta(minutes=1),
        )

        # Attempt payment with retries
        for attempt in range(self.MAX_PAYMENT_ATTEMPTS):
            result = await workflow.execute_activity(
                charge_payment,
                args=[
                    invoice_id,
                    self._state.payment_method_id,
                    total_amount,
                    f"{invoice_id}-attempt-{attempt}",
                ],
                start_to_close_timeout=timedelta(minutes=5),
                retry_policy=RetryPolicy(
                    maximum_attempts=2,  # Network retries
                    non_retryable_error_types=["CardDeclined", "InsufficientFunds"],
                ),
            )

            if result.status == "paid":
                self._state.last_payment_date = workflow.now()
                self._state.failed_payment_attempts = 0
                self._state.status = SubscriptionStatus.ACTIVE
                workflow.logger.info(f"Payment succeeded: {result.payment_id}")
                return True

            # Payment failed
            self._state.failed_payment_attempts = attempt + 1
            self._state.status = SubscriptionStatus.PAST_DUE

            workflow.logger.warning(
                f"Payment failed (attempt {attempt + 1}): {result.error}"
            )

            # Notify customer
            next_retry = None
            if attempt < len(self.PAYMENT_RETRY_INTERVALS):
                next_retry = workflow.now() + self.PAYMENT_RETRY_INTERVALS[attempt]

            await workflow.execute_activity(
                send_payment_failed_notification,
                args=[
                    self._state.customer_id,
                    invoice_id,
                    attempt + 1,
                    next_retry,
                ],
                start_to_close_timeout=timedelta(minutes=1),
            )

            # Wait before retry (unless last attempt)
            if attempt < len(self.PAYMENT_RETRY_INTERVALS):
                await asyncio.sleep(self.PAYMENT_RETRY_INTERVALS[attempt].total_seconds())

        # All attempts failed
        workflow.logger.error(
            f"All payment attempts exhausted for {self._state.subscription_id}"
        )
        return False

    async def _handle_cancellation(self, reason: str):
        """Cancel the subscription."""
        workflow.logger.info(f"Cancelling subscription: {reason}")

        self._state.status = SubscriptionStatus.CANCELLED
        self._state.cancelled_at = workflow.now()

        await workflow.execute_activity(
            send_subscription_cancelled_notification,
            args=[self._state.customer_id, self._state.subscription_id, reason],
            start_to_close_timeout=timedelta(minutes=1),
        )

    async def _handle_pause(self):
        """Pause the subscription."""
        workflow.logger.info("Pausing subscription")

        self._state.status = SubscriptionStatus.PAUSED
        self._state.pause_start = workflow.now()
        self._pause_requested = False

        # Wait for resume signal
        await workflow.wait_condition(
            lambda: self._resume_requested or self._cancel_requested
        )

        if self._resume_requested:
            # Resume from pause
            pause_duration = workflow.now() - self._state.pause_start
            self._state.current_period_end += pause_duration  # Extend period
            self._state.status = SubscriptionStatus.ACTIVE
            self._state.pause_start = None
            self._resume_requested = False
            workflow.logger.info("Subscription resumed")

    async def _apply_plan_change(self):
        """Apply pending plan change with proration."""
        new_plan = self._pending_plan_change
        self._pending_plan_change = None

        now = workflow.now()
        days_remaining = (self._state.current_period_end - now).days
        total_days = (
            self._state.current_period_end - self._state.current_period_start
        ).days

        # Calculate proration
        proration = await workflow.execute_activity(
            calculate_proration,
            args=[self._state.plan, new_plan, days_remaining, total_days],
            start_to_close_timeout=timedelta(seconds=30),
        )

        # Charge or credit proration
        if proration > 0:
            invoice_id = await workflow.execute_activity(
                create_invoice,
                args=[
                    self._state.subscription_id,
                    self._state.customer_id,
                    proration,
                    now,
                    self._state.current_period_end,
                    [{"description": "Plan change proration"}],
                ],
                start_to_close_timeout=timedelta(minutes=1),
            )

            await workflow.execute_activity(
                charge_payment,
                args=[
                    invoice_id,
                    self._state.payment_method_id,
                    proration,
                    f"prorate-{self._state.subscription_id}-{now.isoformat()}",
                ],
                start_to_close_timeout=timedelta(minutes=5),
            )

        # Update plan
        old_plan = self._state.plan
        self._state.plan = new_plan
        workflow.logger.info(f"Plan changed: {old_plan.name} -> {new_plan.name}")

    def _advance_period(self):
        """Advance to the next billing period."""
        self._state.current_period_start = self._state.current_period_end
        self._state.current_period_end = self._calculate_period_end(
            self._state.current_period_start,
            self._state.plan.interval,
        )
        self._state.billing_cycle_count += 1

    def _calculate_period_end(
        self,
        start: datetime,
        interval: BillingInterval,
    ) -> datetime:
        """Calculate billing period end date."""
        if interval == BillingInterval.MONTHLY:
            # Add one month
            if start.month == 12:
                return start.replace(year=start.year + 1, month=1)
            return start.replace(month=start.month + 1)
        elif interval == BillingInterval.QUARTERLY:
            # Add three months
            month = start.month + 3
            year = start.year
            if month > 12:
                month -= 12
                year += 1
            return start.replace(year=year, month=month)
        elif interval == BillingInterval.YEARLY:
            return start.replace(year=start.year + 1)
        else:
            raise ValueError(f"Unknown interval: {interval}")

    async def _wait_until(self, target: datetime):
        """Wait until target time, handling signals."""
        while workflow.now() < target:
            remaining = (target - workflow.now()).total_seconds()

            # Wait in chunks to check for signals
            wait_time = min(remaining, 3600)  # Max 1 hour chunks

            try:
                await workflow.wait_condition(
                    lambda: (
                        self._cancel_requested
                        or self._pause_requested
                        or self._resume_requested
                        or self._pending_plan_change is not None
                    ),
                    timeout=timedelta(seconds=wait_time),
                )
                # Signal received - return to main loop
                return
            except asyncio.TimeoutError:
                # No signal, continue waiting
                continue

    def _create_continuation_input(self) -> SubscriptionInput:
        """Create input for continue-as-new."""
        return SubscriptionInput(
            subscription_id=self._state.subscription_id,
            customer_id=self._state.customer_id,
            plan=self._state.plan,
            payment_method_id=self._state.payment_method_id,
            start_date=self._state.current_period_start,
        )

    # =========================================================================
    # Signals
    # =========================================================================

    @workflow.signal
    async def cancel(self, reason: str = "customer_requested"):
        """Cancel the subscription at end of current period."""
        workflow.logger.info(f"Cancel requested: {reason}")
        self._cancel_requested = True

    @workflow.signal
    async def pause(self):
        """Pause the subscription."""
        workflow.logger.info("Pause requested")
        self._pause_requested = True

    @workflow.signal
    async def resume(self):
        """Resume a paused subscription."""
        workflow.logger.info("Resume requested")
        self._resume_requested = True

    @workflow.signal
    async def change_plan(self, new_plan: Plan):
        """Change subscription plan (takes effect next cycle)."""
        workflow.logger.info(f"Plan change requested: {new_plan.name}")
        self._pending_plan_change = new_plan

    @workflow.signal
    async def update_payment_method(self, payment_method_id: str):
        """Update payment method."""
        workflow.logger.info(f"Payment method updated: {payment_method_id}")
        self._state.payment_method_id = payment_method_id

    # =========================================================================
    # Queries
    # =========================================================================

    @workflow.query
    def get_status(self) -> str:
        """Get subscription status."""
        return self._state.status.value if self._state else "unknown"

    @workflow.query
    def get_state(self) -> dict:
        """Get full subscription state."""
        if not self._state:
            return {}

        return {
            "subscription_id": self._state.subscription_id,
            "customer_id": self._state.customer_id,
            "plan": {
                "id": self._state.plan.plan_id,
                "name": self._state.plan.name,
                "amount": str(self._state.plan.amount),
            },
            "status": self._state.status.value,
            "current_period_start": self._state.current_period_start.isoformat(),
            "current_period_end": self._state.current_period_end.isoformat(),
            "billing_cycle_count": self._state.billing_cycle_count,
            "failed_payment_attempts": self._state.failed_payment_attempts,
            "last_payment_date": (
                self._state.last_payment_date.isoformat()
                if self._state.last_payment_date
                else None
            ),
            "pending_plan_change": (
                self._pending_plan_change.name if self._pending_plan_change else None
            ),
        }

    @workflow.query
    def get_next_billing_date(self) -> str | None:
        """Get next billing date."""
        if not self._state or self._state.status != SubscriptionStatus.ACTIVE:
            return None
        return self._state.current_period_end.isoformat()


# ============================================================================
# Client Usage Example
# ============================================================================


async def example_usage():
    """Example: Create and manage a subscription."""
    client = await Client.connect("localhost:7233")

    # Create subscription
    plan = Plan(
        plan_id="pro-monthly",
        name="Pro Monthly",
        amount=Decimal("29.99"),
        interval=BillingInterval.MONTHLY,
        trial_days=14,
    )

    sub_input = SubscriptionInput(
        subscription_id="sub-12345",
        customer_id="cust-001",
        plan=plan,
        payment_method_id="pm-card-123",
    )

    handle = await client.start_workflow(
        SubscriptionBillingWorkflow.run,
        sub_input,
        id=f"subscription-{sub_input.subscription_id}",
        task_queue="billing",
    )

    print(f"Started subscription workflow: {handle.id}")

    # Query status
    await asyncio.sleep(1)
    status = await handle.query(SubscriptionBillingWorkflow.get_status)
    print(f"Subscription status: {status}")

    # Upgrade plan
    new_plan = Plan(
        plan_id="enterprise-monthly",
        name="Enterprise Monthly",
        amount=Decimal("99.99"),
        interval=BillingInterval.MONTHLY,
    )
    await handle.signal(SubscriptionBillingWorkflow.change_plan, new_plan)
    print("Plan upgrade scheduled")

    # Get full state
    state = await handle.query(SubscriptionBillingWorkflow.get_state)
    print(f"Full state: {state}")


# ============================================================================
# Worker Setup
# ============================================================================


async def run_worker():
    """Run the billing worker."""
    client = await Client.connect("localhost:7233")

    worker = Worker(
        client,
        task_queue="billing",
        workflows=[SubscriptionBillingWorkflow],
        activities=[
            create_invoice,
            charge_payment,
            send_payment_failed_notification,
            send_subscription_cancelled_notification,
            get_usage_records,
            calculate_proration,
            update_subscription_in_database,
        ],
    )

    print("Starting billing worker...")
    await worker.run()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "client":
        asyncio.run(example_usage())
    else:
        asyncio.run(run_worker())
