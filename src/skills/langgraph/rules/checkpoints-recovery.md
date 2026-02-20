---
title: Recover interrupted workflow state and debug checkpoint history
impact: HIGH
impactDescription: "Without recovery logic, interrupted workflows require manual restart from scratch"
tags: checkpoints, recovery, resume, debugging, history
---

## State Recovery and Debugging

Resume interrupted workflows and inspect checkpoint history for debugging.

**Incorrect — no recovery handling:**
```python
# If this crashes at step 5 of 10, all progress is lost
result = app.invoke(initial_state)
```

**Correct — automatic recovery:**
```python
import logging

async def run_with_recovery(workflow_id: str, initial_state: dict):
    """Run workflow with automatic recovery from checkpoint."""
    config = {"configurable": {"thread_id": workflow_id}}

    try:
        state = app.get_state(config)
        if state.values:
            logging.info(f"Resuming workflow {workflow_id}")
            return app.invoke(None, config=config)  # None = resume from checkpoint
    except Exception:
        pass  # No existing checkpoint

    logging.info(f"Starting new workflow {workflow_id}")
    return app.invoke(initial_state, config=config)
```

**Debugging with checkpoint history:**
```python
# Get all checkpoints for a workflow
config = {"configurable": {"thread_id": "analysis-123"}}
for checkpoint in app.get_state_history(config):
    print(f"Step: {checkpoint.metadata['step']}")
    print(f"Node: {checkpoint.metadata['source']}")
    print(f"State: {checkpoint.values}")

# Rollback to previous checkpoint
history = list(app.get_state_history(config))
previous = history[1]  # One step back
app.update_state(config, previous.values)
```

**Graph Migrations (2026):** LangGraph handles topology changes automatically — adding/removing nodes, adding/removing state keys. Limitation: can't remove a node if a thread is interrupted at that node.

**Key rules:**
- Pass `None` as input to resume from checkpoint
- Use `get_state_history()` to inspect all checkpoints
- Use `update_state()` for rollback/manual state correction
- Clean up old checkpoints (TTL-based or keep-latest-N)

Reference: [LangGraph Persistence](https://langchain-ai.github.io/langgraph/concepts/persistence/)
