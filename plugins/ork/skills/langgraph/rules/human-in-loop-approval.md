---
title: Approval Gate Pattern
impact: MEDIUM
impactDescription: "Approval gates without reject paths create dead-end workflows"
tags: human-in-loop, approval, gate, review, interrupt-before
---

## Approval Gate Pattern

Use `interrupt_before` for static approval points. Update state and resume.

**Incorrect — no reject path:**
```python
app = workflow.compile(interrupt_before=["publish"])

# Human reviews...
state.values["approved"] = True
app.update_state(config, state.values)
result = app.invoke(None, config)
# What if human rejects? No path!
```

**Correct — approval with approve/reject paths:**
```python
def approval_gate(state) -> str:
    if not state.get("human_reviewed"):
        return state  # Pauses here due to interrupt_before

    if state["approved"]:
        return {"next": "publish"}
    else:
        return {"next": "revise"}

# Compile with interrupt
app = workflow.compile(interrupt_before=["approval_gate"])

# Step 1: Run until approval gate
config = {"configurable": {"thread_id": "doc-123"}}
result = app.invoke({"topic": "AI"}, config=config)

# Step 2: Human reviews
state = app.get_state(config)
print(f"Draft: {state.values['draft']}")

# Step 3: Human decides
app.update_state(config, {
    "approved": True,
    "feedback": "Looks good",
    "human_reviewed": True,
})

# Step 4: Resume
result = app.invoke(None, config=config)
```

**Multiple approval points:**
```python
app = workflow.compile(interrupt_before=["first_review", "final_review"])
```

**Key rules:**
- Always include both approve and reject paths
- Set timeout for human review (24-48h, auto-reject after)
- Send notification when workflow pauses (email/Slack)
- Use `get_state()` to show current state for review

Reference: [LangGraph Human-in-the-Loop](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/)
