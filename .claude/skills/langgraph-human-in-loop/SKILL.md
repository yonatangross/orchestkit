---
name: langgraph-human-in-loop
description: LangGraph human-in-the-loop patterns. Use when implementing approval workflows, manual review gates, user feedback integration, or interactive agent supervision.
---

# LangGraph Human-in-the-Loop

Pause workflows for human intervention and approval.

## When to Use

- Approval before publishing
- Manual review of AI outputs
- User feedback integration
- Interactive agent supervision

## Basic Interrupt

```python
workflow = StateGraph(State)
workflow.add_node("draft", generate_draft)
workflow.add_node("review", human_review)
workflow.add_node("publish", publish_content)

# Interrupt before review
app = workflow.compile(interrupt_before=["review"])

# Step 1: Generate draft (stops at review)
config = {"configurable": {"thread_id": "doc-123"}}
result = app.invoke({"topic": "AI"}, config=config)
# Workflow pauses here
```

## Resume After Approval

```python
# Step 2: Human reviews and updates state
state = app.get_state(config)
print(f"Draft: {state.values['draft']}")

# Human decision
state.values["approved"] = True
state.values["feedback"] = "Looks good"
app.update_state(config, state.values)

# Step 3: Resume workflow
result = app.invoke(None, config=config)  # Continues to publish
```

## Approval Gate Node

```python
def approval_gate(state: WorkflowState) -> WorkflowState:
    """Check if human approved."""
    if not state.get("human_reviewed"):
        # Will pause here due to interrupt_before
        return state

    if state["approved"]:
        state["next"] = "publish"
    else:
        state["next"] = "revise"

    return state

workflow.add_node("approval_gate", approval_gate)

# Pause before this node
app = workflow.compile(interrupt_before=["approval_gate"])
```

## Feedback Loop Pattern

```python
async def run_with_feedback(initial_state: dict):
    """Run until human approves."""
    config = {"configurable": {"thread_id": str(uuid4())}}

    while True:
        # Run until interrupt
        result = app.invoke(initial_state, config=config)

        # Get current state
        state = app.get_state(config)

        # Present to human
        print(f"Output: {state.values['output']}")
        feedback = input("Approve? (yes/no/feedback): ")

        if feedback.lower() == "yes":
            state.values["approved"] = True
            app.update_state(config, state.values)
            return app.invoke(None, config=config)
        elif feedback.lower() == "no":
            return {"status": "rejected"}
        else:
            # Incorporate feedback and retry
            state.values["feedback"] = feedback
            state.values["retry_count"] = state.values.get("retry_count", 0) + 1
            app.update_state(config, state.values)
            initial_state = None  # Resume from checkpoint
```

## API Integration

```python
from fastapi import FastAPI, HTTPException

app = FastAPI()

@app.post("/workflows/{workflow_id}/approve")
async def approve_workflow(workflow_id: str, approved: bool, feedback: str = ""):
    """API endpoint for human approval."""
    config = {"configurable": {"thread_id": workflow_id}}

    try:
        state = langgraph_app.get_state(config)
    except Exception:
        raise HTTPException(404, "Workflow not found")

    # Update state with human decision
    state.values["approved"] = approved
    state.values["feedback"] = feedback
    state.values["human_reviewed"] = True
    langgraph_app.update_state(config, state.values)

    # Resume workflow
    result = langgraph_app.invoke(None, config=config)

    return {"status": "completed", "result": result}
```

## Multiple Approval Points

```python
# Interrupt at multiple points
app = workflow.compile(
    interrupt_before=["first_review", "final_review"]
)

# First review
result = app.invoke(initial_state, config=config)
# ... human approves first review ...
app.update_state(config, {"first_approved": True})

# Continue to second review
result = app.invoke(None, config=config)
# ... human approves final review ...
app.update_state(config, {"final_approved": True})

# Complete workflow
result = app.invoke(None, config=config)
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Interrupt point | Before critical nodes |
| Timeout | 24-48h for human review |
| Notification | Email/Slack when paused |
| Fallback | Auto-reject after timeout |

## Common Mistakes

- No timeout (workflows hang forever)
- No notification (humans don't know to review)
- Losing checkpoint (can't resume)
- No reject path (only approve works)

## Related Skills

- `langgraph-checkpoints` - State persistence
- `langgraph-routing` - Routing after approval
- `api-design-framework` - Review API design
