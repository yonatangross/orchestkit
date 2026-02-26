---
title: Use interrupt() for conditional pausing and Command for resuming workflows
impact: MEDIUM
impactDescription: "Wrapping interrupt() in try/except catches the interrupt exception and breaks the mechanism"
tags: human-in-loop, interrupt, resume, command, pause
---

## Dynamic Interrupt and Resume

Use `interrupt()` for conditional pausing and `Command(resume=)` for resuming.

**Incorrect — interrupt in try/except:**
```python
def approval_node(state):
    try:
        response = interrupt({"question": "Approve?"})  # interrupt raises!
    except Exception:
        response = {"approved": False}  # Catches the interrupt exception — broken
```

**Correct — dynamic interrupt (2026 pattern):**
```python
from langgraph.types import interrupt, Command

def approval_node(state):
    """Conditionally interrupt based on risk level."""
    if state["risk_level"] == "high":
        response = interrupt({
            "question": "High-risk action. Approve?",
            "action": state["proposed_action"],
            "risk_level": state["risk_level"],
        })
        if not response.get("approved"):
            return {"status": "rejected", "action": None}

    return {"status": "approved", "action": state["proposed_action"]}
```

**Resume with Command:**
```python
config = {"configurable": {"thread_id": "workflow-123"}}

# Initial run — stops at interrupt
result = graph.invoke(initial_state, config)

# Check for interrupt
if "__interrupt__" in result:
    info = result["__interrupt__"][0].value
    print(f"Question: {info['question']}")

    # Resume with user response
    final = graph.invoke(Command(resume={"approved": True}), config)
```

**Critical rules:**
- **DO:** Place side effects AFTER interrupt calls
- **DO:** Make pre-interrupt side effects idempotent (upsert, not create)
- **DO:** Keep interrupt call order consistent across executions
- **DON'T:** Wrap interrupt in bare try/except
- **DON'T:** Conditionally skip interrupt calls (breaks determinism)
- **DON'T:** Pass functions or class instances to interrupt()

Reference: [LangGraph Human-in-the-Loop](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/)
