---
title: Gate dangerous tool execution with interrupt-based human approval before proceeding
impact: CRITICAL
impactDescription: "Dangerous tools without approval gates can execute destructive operations unchecked"
tags: tools, interrupt, approval, gate, human-review
---

## Tool Interrupt Approval Gates

Use `interrupt()` inside tool functions for human approval before destructive operations.

**Incorrect — no approval for dangerous operation:**
```python
@tool
def delete_user(user_id: str) -> str:
    """Delete a user account."""
    db.delete_user(user_id)  # Executes immediately without approval!
    return f"User {user_id} deleted"
```

**Correct — interrupt for approval:**
```python
from langgraph.types import interrupt

@tool
def delete_user(user_id: str) -> str:
    """Delete a user account. Requires approval."""
    response = interrupt({
        "action": "delete_user",
        "user_id": user_id,
        "message": f"Approve deletion of user {user_id}?",
        "risk_level": "high",
    })

    if response.get("approved"):
        db.delete_user(user_id)
        return f"User {user_id} deleted successfully"
    return "Deletion cancelled by user"

@tool
def transfer_funds(from_account: str, to_account: str, amount: float) -> str:
    """Transfer funds. Requires approval for large amounts."""
    if amount > 1000:
        response = interrupt({
            "action": "transfer_funds",
            "amount": amount,
            "message": f"Approve transfer of ${amount}?",
        })
        if not response.get("approved"):
            return "Transfer cancelled"

    execute_transfer(from_account, to_account, amount)
    return f"Transferred ${amount}"
```

**Streaming from tools:**
```python
from langgraph.config import get_stream_writer

@tool
def long_running_analysis(data: str) -> str:
    writer = get_stream_writer()
    writer({"status": "starting", "progress": 0})
    for i, chunk in enumerate(process_chunks(data)):
        writer({"status": "processing", "progress": (i + 1) * 10})
    return "Analysis complete"
```

**Key rules:**
- Use `interrupt()` for any destructive or high-risk tool
- Return error strings from tools, don't raise exceptions (lets agent recover)
- Place side effects AFTER interrupt calls (not before)
- Use `get_stream_writer()` for long-running tool progress

Reference: [LangGraph Human-in-the-Loop](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/)
