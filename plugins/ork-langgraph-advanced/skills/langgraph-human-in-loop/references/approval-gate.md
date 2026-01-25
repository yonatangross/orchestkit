# Approval Gate Pattern

Route workflow based on human approval decisions.

## Implementation

```python
from langgraph.graph import StateGraph, END

def approval_gate(state: WorkflowState) -> dict:
    """Check human approval status and route accordingly."""
    if not state.get("human_reviewed"):
        # State will be updated by human via API
        return {"awaiting_review": True}

    if state["approved"]:
        return {"next": "publish", "awaiting_review": False}
    elif state.get("feedback"):
        return {"next": "revise", "awaiting_review": False}
    else:
        return {"next": END, "status": "rejected"}

workflow = StateGraph(WorkflowState)
workflow.add_node("generate", generate_node)
workflow.add_node("approval_gate", approval_gate)
workflow.add_node("revise", revise_node)
workflow.add_node("publish", publish_node)

workflow.add_edge("generate", "approval_gate")
workflow.add_edge("revise", "approval_gate")  # Re-review after revision

workflow.add_conditional_edges(
    "approval_gate",
    lambda s: s.get("next", "approval_gate"),
    {"publish": "publish", "revise": "revise", END: END}
)

app = workflow.compile(interrupt_before=["approval_gate"])
```

## When to Use

- Approve/reject/revise workflows
- Multi-stage approval processes
- Iterative refinement with feedback
- Gated publishing pipelines

## Anti-patterns

- No revise path (only approve/reject)
- No max revision limit (infinite loops)
- Approval without viewing content
- Missing audit trail of decisions