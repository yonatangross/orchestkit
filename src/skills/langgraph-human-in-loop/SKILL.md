---
name: langgraph-human-in-loop
description: LangGraph human-in-the-loop patterns. Use when implementing approval workflows, manual review gates, user feedback integration, or interactive agent supervision.
tags: [langgraph, human-in-loop, review, approval]
context: fork
agent: workflow-architect
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# LangGraph Human-in-the-Loop

Pause workflows for human intervention and approval.

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

## Dynamic interrupt() Function (2026 Best Practice)

Modern approach using `interrupt()` within node logic:

```python
from langgraph.types import interrupt, Command

def approval_node(state: State):
    """Dynamic interrupt based on conditions."""
    # Only interrupt for high-risk actions
    if state["risk_level"] == "high":
        response = interrupt({
            "question": "High-risk action detected. Approve?",
            "action": state["proposed_action"],
            "risk_level": state["risk_level"],
            "details": state["action_details"]
        })

        if not response.get("approved"):
            return {"status": "rejected", "action": None}

    # Low risk or approved - proceed
    return {"status": "approved", "action": state["proposed_action"]}
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

## Command(resume=) Pattern (2026 Best Practice)

```python
from langgraph.types import Command

config = {"configurable": {"thread_id": "workflow-123"}}

# Initial invoke - stops at interrupt
result = graph.invoke(initial_state, config)

# Check for interrupt
if "__interrupt__" in result:
    interrupt_info = result["__interrupt__"][0].value
    print(f"Action: {interrupt_info['action']}")
    print(f"Question: {interrupt_info['question']}")

    # Get user decision
    user_response = {"approved": True, "feedback": "Looks good"}

    # Resume with Command
    final = graph.invoke(Command(resume=user_response), config)
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
import uuid

async def run_with_feedback(initial_state: dict):
    """Run until human approves."""
    config = {"configurable": {"thread_id": str(uuid.uuid4())}}

    while True:
        # Run until interrupt
        result = app.invoke(initial_state, config=config)

        # Check for interrupt
        if "__interrupt__" not in result:
            return result  # Completed without interrupt

        interrupt_info = result["__interrupt__"][0].value
        print(f"Output: {interrupt_info.get('output', 'N/A')}")
        feedback = input("Approve? (yes/no/feedback): ")

        if feedback.lower() == "yes":
            return app.invoke(Command(resume={"approved": True}), config=config)
        elif feedback.lower() == "no":
            return {"status": "rejected"}
        else:
            # Incorporate feedback and retry
            initial_state = None
            result = app.invoke(
                Command(resume={"approved": False, "feedback": feedback}),
                config=config
            )
```

## Input Validation Loop

```python
from langgraph.types import interrupt

def get_valid_age(state: State):
    """Repeatedly prompt until valid input."""
    prompt = "What is your age?"

    while True:
        answer = interrupt(prompt)

        # Validate
        if isinstance(answer, int) and 0 < answer < 150:
            return {"age": answer}

        # Invalid - update prompt and continue
        prompt = f"'{answer}' is not valid. Please enter a number between 1 and 150."
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

## Critical Rules

**DO:**
- Place side effects AFTER interrupt calls
- Make pre-interrupt side effects idempotent (upsert vs create)
- Keep interrupt call order consistent across executions
- Pass simple, JSON-serializable values to interrupt()

**DON'T:**
- Wrap interrupt in bare try/except (catches the interrupt exception)
- Conditionally skip interrupt calls (breaks determinism)
- Pass functions or class instances to interrupt()
- Create non-idempotent records before interrupts (duplicates on resume)

## Common Mistakes

- No timeout (workflows hang forever)
- No notification (humans don't know to review)
- Losing checkpoint (can't resume)
- No reject path (only approve works)
- Wrapping interrupt() in try/except (breaks the mechanism)
- Non-deterministic interrupt call order (breaks resumption)

## Evaluations

See [references/evaluations.md](references/evaluations.md) for test cases.

## Related Skills

- `langgraph-checkpoints` - Persist state across human review pauses
- `langgraph-routing` - Route based on approval/rejection decisions
- `langgraph-tools` - Add approval gates before dangerous tool execution
- `langgraph-supervisor` - Human approval in supervisor routing
- `langgraph-streaming` - Stream status while waiting for human input
- `api-design-framework` - Design review API endpoints

## Capability Details

### interrupt-before
**Keywords:** interrupt, pause, stop, before, gate
**Solves:**
- How do I pause a workflow for approval?
- Add human review before a step
- Interrupt workflow execution

### resume-workflow
**Keywords:** resume, continue, approve, proceed, update_state
**Solves:**
- How do I resume after human approval?
- Continue workflow after review
- Update state and proceed

### approval-patterns
**Keywords:** approval, approve, reject, decision, gate
**Solves:**
- How do I implement approval workflows?
- Add approval gate to pipeline
- Handle approve/reject decisions

### feedback-integration
**Keywords:** feedback, comment, review, notes, human input
**Solves:**
- How do I collect human feedback?
- Integrate reviewer comments
- Capture feedback in workflow state

### interactive-supervision
**Keywords:** supervise, monitor, interactive, control, override
**Solves:**
- How do I supervise agent execution?
- Add human oversight to agents
- Override agent decisions

### state-inspection
**Keywords:** get_state, inspect, view, current state, debug
**Solves:**
- How do I inspect workflow state?
- View current state at interrupt
- Debug paused workflows
