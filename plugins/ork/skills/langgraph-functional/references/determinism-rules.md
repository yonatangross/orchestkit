# Determinism Rules Reference

Critical rules for resumable functional workflows.

## The Problem

When a workflow is interrupted and resumed, the entrypoint function runs again from the beginning. Tasks that already completed return their cached results. But code OUTSIDE tasks runs fresh each time.

## Rule 1: Non-Deterministic Ops in Tasks

```python
import time
import random
from langgraph.func import entrypoint, task

# WRONG: Time captured outside task
@entrypoint(checkpointer=checkpointer)
def bad_workflow(input: dict) -> dict:
    timestamp = time.time()  # Different on every resume!

    result = process(input).result()
    approved = interrupt("Approve?")  # User interrupts here

    # On resume, timestamp is DIFFERENT
    return {"result": result, "timestamp": timestamp}

# CORRECT: Time captured in task
@task
def get_timestamp() -> float:
    return time.time()

@entrypoint(checkpointer=checkpointer)
def good_workflow(input: dict) -> dict:
    timestamp = get_timestamp().result()  # Cached on resume

    result = process(input).result()
    approved = interrupt("Approve?")

    # On resume, timestamp is SAME (from cache)
    return {"result": result, "timestamp": timestamp}
```

## Rule 2: Consistent Interrupt Order

```python
# WRONG: Conditional interrupt
@entrypoint(checkpointer=checkpointer)
def bad_workflow(input: dict) -> dict:
    if random.random() > 0.5:  # Non-deterministic!
        value = interrupt("Question 1")
    else:
        value = interrupt("Question 2")  # Different interrupt on resume
    return {"value": value}

# CORRECT: Deterministic interrupt order
@entrypoint(checkpointer=checkpointer)
def good_workflow(input: dict) -> dict:
    # Always same interrupts in same order
    q1 = interrupt("Question 1")
    if needs_q2(q1):
        q2 = interrupt("Question 2")
    return {"q1": q1, "q2": q2}
```

## Rule 3: Task All Non-Determinism

Non-deterministic operations that should be consistent on resume:

```python
@task
def get_random_id() -> str:
    """Random ID, but consistent on resume."""
    return str(uuid.uuid4())

@task
def fetch_external_data(url: str) -> dict:
    """API call, but consistent on resume."""
    return requests.get(url).json()

@task
def get_current_user() -> dict:
    """Session-dependent, but consistent on resume."""
    return auth.get_current_user()

@entrypoint(checkpointer=checkpointer)
def workflow(input: dict) -> dict:
    # All non-deterministic ops in tasks
    request_id = get_random_id().result()
    external = fetch_external_data(input["url"]).result()
    user = get_current_user().result()

    # Now these values are stable across resume
    approved = interrupt(f"Approve for {user['name']}?")

    return {"id": request_id, "data": external, "approved": approved}
```

## What's Safe Outside Tasks

```python
@entrypoint(checkpointer=checkpointer)
def workflow(input: dict) -> dict:
    # SAFE: Pure computations
    doubled = input["value"] * 2
    formatted = f"Result: {input['name']}"

    # SAFE: Deterministic conditionals
    if input["type"] == "premium":
        result = premium_process(input).result()
    else:
        result = standard_process(input).result()

    return {"result": result}
```

## Summary

| Operation | Where | Why |
|-----------|-------|-----|
| `time.time()` | Task | Changes on resume |
| `random.*` | Task | Changes on resume |
| `uuid.uuid4()` | Task | Changes on resume |
| API calls | Task | Response may differ |
| `input["key"]` | Entrypoint | Same input on resume |
| Pure computation | Entrypoint | Deterministic |
