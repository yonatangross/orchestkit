# Tool Interrupts Reference

Add human approval gates to tool execution.

## Basic Tool Interrupt

```python
from langchain_core.tools import tool
from langgraph.types import interrupt

@tool
def delete_record(record_id: str) -> str:
    """Delete a database record. Requires approval."""
    # Pause for human approval
    response = interrupt({
        "action": "delete_record",
        "record_id": record_id,
        "message": f"Approve deletion of record {record_id}?",
        "risk_level": "high"
    })

    if response.get("approved"):
        db.delete(record_id)
        return f"Record {record_id} deleted"

    return "Deletion cancelled by user"
```

## Conditional Approval

```python
@tool
def transfer_funds(from_acc: str, to_acc: str, amount: float) -> str:
    """Transfer funds. Large amounts require approval."""
    # Only interrupt for large transfers
    if amount > 1000:
        response = interrupt({
            "action": "transfer_funds",
            "from": from_acc,
            "to": to_acc,
            "amount": amount,
            "message": f"Approve transfer of ${amount:.2f}?"
        })

        if not response.get("approved"):
            return "Transfer cancelled"

    # Execute transfer
    execute_transfer(from_acc, to_acc, amount)
    return f"Transferred ${amount:.2f}"
```

## Editable Parameters

```python
@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send email. User can edit before sending."""
    # Allow user to review and edit
    response = interrupt({
        "action": "send_email",
        "to": to,
        "subject": subject,
        "body": body,
        "message": "Review email before sending. You can edit fields.",
        "editable": ["to", "subject", "body"]
    })

    if response.get("approved"):
        # Use potentially edited values
        final_to = response.get("to", to)
        final_subject = response.get("subject", subject)
        final_body = response.get("body", body)

        email_service.send(final_to, final_subject, final_body)
        return f"Email sent to {final_to}"

    return "Email cancelled"
```

## Resuming Tool Interrupts

```python
from langgraph.types import Command

config = {"configurable": {"thread_id": "thread-1"}}

# Initial invoke - stops at tool interrupt
result = graph.invoke(
    {"messages": [("user", "Delete user 123")]},
    config
)

# Check for interrupt
if "__interrupt__" in result:
    interrupt_data = result["__interrupt__"][0].value
    print(f"Action: {interrupt_data['action']}")
    print(f"Message: {interrupt_data['message']}")

    # Get user decision
    approved = input("Approve? (y/n): ").lower() == "y"

    # Resume with decision
    final = graph.invoke(
        Command(resume={"approved": approved}),
        config
    )
```

## Multiple Approval Levels

```python
@tool
def critical_operation(data: str) -> str:
    """Operation requiring multiple approvals."""
    # First approval: Team lead
    lead_approval = interrupt({
        "level": 1,
        "role": "team_lead",
        "message": "Team lead approval required"
    })

    if not lead_approval.get("approved"):
        return "Rejected by team lead"

    # Second approval: Manager (for critical ops)
    if is_critical(data):
        manager_approval = interrupt({
            "level": 2,
            "role": "manager",
            "message": "Manager approval required for critical operation"
        })

        if not manager_approval.get("approved"):
            return "Rejected by manager"

    # Execute
    return execute_operation(data)
```

## Streaming with Tool Interrupts

```python
async for mode, chunk in graph.astream(
    inputs,
    stream_mode=["updates", "messages"],
    config=config
):
    if mode == "updates" and "__interrupt__" in chunk:
        # Tool interrupt detected
        interrupt_info = chunk["__interrupt__"][0].value

        # Show to user
        user_response = await get_user_approval(interrupt_info)

        # Resume
        async for m, c in graph.astream(
            Command(resume=user_response),
            stream_mode=["updates", "messages"],
            config=config
        ):
            yield m, c
        break

    yield mode, chunk
```
