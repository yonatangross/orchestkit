# API Integration for Human Review

Expose REST endpoints for human-in-the-loop workflows.

## Implementation

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class ApprovalRequest(BaseModel):
    approved: bool
    feedback: str = ""
    reviewer_id: str

class WorkflowStatus(BaseModel):
    workflow_id: str
    status: str
    current_node: str
    awaiting_review: bool

@app.get("/workflows/{workflow_id}/status")
async def get_workflow_status(workflow_id: str) -> WorkflowStatus:
    """Get current workflow state for review UI."""
    config = {"configurable": {"thread_id": workflow_id}}
    try:
        state = langgraph_app.get_state(config)
        return WorkflowStatus(
            workflow_id=workflow_id,
            status="pending_review" if state.next else "completed",
            current_node=state.next[0] if state.next else "end",
            awaiting_review=state.values.get("awaiting_review", False)
        )
    except Exception:
        raise HTTPException(404, "Workflow not found")

@app.post("/workflows/{workflow_id}/approve")
async def approve_workflow(workflow_id: str, request: ApprovalRequest):
    """Submit human approval decision."""
    config = {"configurable": {"thread_id": workflow_id}}
    state = langgraph_app.get_state(config)

    state.values.update({
        "approved": request.approved,
        "feedback": request.feedback,
        "human_reviewed": True,
        "reviewer_id": request.reviewer_id
    })
    langgraph_app.update_state(config, state.values)

    result = await langgraph_app.ainvoke(None, config=config)
    return {"status": "completed", "result": result}
```

## When to Use

- Web-based review interfaces
- Mobile approval workflows
- Integration with external systems
- Async human review processes

## Anti-patterns

- No authentication on approval endpoints
- Missing audit logging
- No idempotency for approval calls
- Blocking API calls (use background tasks)