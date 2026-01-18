# Signals, Queries, and Updates

## Signals

Async external input to running workflows.

```python
from temporalio import workflow
from dataclasses import dataclass

@dataclass
class ApprovalSignal:
    approved: bool
    approver: str
    comment: str

@workflow.defn
class ApprovalWorkflow:
    def __init__(self):
        self._pending_approvals: list[ApprovalSignal] = []
        self._approved = False

    @workflow.run
    async def run(self, request: ApprovalRequest) -> ApprovalResult:
        # Wait for approval signal
        await workflow.wait_condition(lambda: self._approved)
        return ApprovalResult(
            status="approved",
            approvals=self._pending_approvals,
        )

    @workflow.signal
    async def approve(self, signal: ApprovalSignal):
        """Receive approval from external system."""
        self._pending_approvals.append(signal)
        if len(self._pending_approvals) >= 2:  # Require 2 approvals
            self._approved = True

    @workflow.signal
    async def cancel(self, reason: str):
        """Cancel the approval request."""
        raise workflow.ContinueAsNewError(
            CancelledRequest(reason=reason)
        )
```

**Signal from client:**
```python
handle = client.get_workflow_handle("approval-123")
await handle.signal(ApprovalWorkflow.approve, ApprovalSignal(
    approved=True,
    approver="manager@example.com",
    comment="LGTM",
))
```

## Queries

Synchronous state inspection (read-only).

```python
@workflow.defn
class OrderWorkflow:
    def __init__(self):
        self._status = "pending"
        self._items: list[str] = []

    @workflow.query
    def get_status(self) -> str:
        """Query current order status."""
        return self._status

    @workflow.query
    def get_items(self) -> list[str]:
        """Query order items."""
        return self._items.copy()  # Return copy to prevent mutation
```

**Query from client:**
```python
handle = client.get_workflow_handle("order-456")
status = await handle.query(OrderWorkflow.get_status)
items = await handle.query(OrderWorkflow.get_items)
```

## Updates (Temporal 1.10+)

Synchronous state mutation with validation.

```python
from temporalio import workflow

@workflow.defn
class ShippingWorkflow:
    def __init__(self):
        self._address: Address | None = None
        self._shipped = False

    @workflow.update
    async def update_address(self, new_address: Address) -> bool:
        """Update shipping address with validation."""
        if self._shipped:
            return False  # Cannot update after shipping

        # Validate address via activity
        valid = await workflow.execute_activity(
            validate_address,
            new_address,
            start_to_close_timeout=timedelta(seconds=10),
        )

        if valid:
            self._address = new_address
            return True
        return False

    @workflow.update_validator
    def validate_update_address(self, new_address: Address):
        """Reject invalid updates before processing."""
        if not new_address.street or not new_address.city:
            raise ValueError("Address must have street and city")
```

**Update from client:**
```python
handle = client.get_workflow_handle("shipping-789")
success = await handle.execute_update(
    ShippingWorkflow.update_address,
    Address(street="123 Main St", city="NYC"),
)
```

## Comparison

| Feature | Signal | Query | Update |
|---------|--------|-------|--------|
| Direction | Fire-and-forget | Read-only | Request-response |
| Blocks caller | No | Yes | Yes |
| Can mutate state | Yes | No | Yes |
| Can run activities | Yes | No | Yes |
| Validation | None | N/A | `@update_validator` |
