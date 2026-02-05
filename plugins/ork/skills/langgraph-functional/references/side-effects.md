# Side Effects Reference

Handle side effects correctly in resumable workflows.

## The Problem

When a workflow resumes, code before the interrupt runs again. Side effects (emails, database writes, file operations) would execute multiple times.

## Rule: Side Effects in Tasks

Tasks are cached. If a task completed before interrupt, it won't run again on resume.

```python
from langgraph.func import entrypoint, task
from langgraph.types import interrupt

@task
def send_notification(user_id: str, message: str) -> bool:
    """Side effect in task - runs once, cached on resume."""
    email_service.send(user_id, message)
    return True

@task
def create_record(data: dict) -> str:
    """Database write in task - runs once."""
    record = db.insert(data)
    return record.id

@entrypoint(checkpointer=checkpointer)
def workflow(input: dict) -> dict:
    # This runs once, then cached
    notification_sent = send_notification(
        input["user_id"],
        "Starting process"
    ).result()

    # This also runs once
    record_id = create_record(input["data"]).result()

    # User pauses here
    approved = interrupt({
        "message": "Approve the record?",
        "record_id": record_id
    })

    # On resume: notification NOT re-sent, record NOT re-created
    # (task results are cached)

    if approved:
        finalize_record(record_id).result()

    return {"record_id": record_id, "approved": approved}
```

## Pattern: Side Effects After Interrupt

When possible, place side effects AFTER the interrupt:

```python
@entrypoint(checkpointer=checkpointer)
def workflow(input: dict) -> dict:
    # Prepare (no side effects)
    draft = prepare_email(input).result()

    # Get approval FIRST
    approved = interrupt({
        "action": "send_email",
        "draft": draft,
        "message": "Approve sending this email?"
    })

    # Side effect AFTER approval (only runs if approved)
    if approved:
        send_email(draft).result()  # Safe - only runs once

    return {"sent": approved}
```

## Pattern: Idempotent Operations

Make pre-interrupt side effects idempotent:

```python
@task
def upsert_record(data: dict) -> str:
    """Idempotent: same result if called twice."""
    # Use upsert, not insert
    record = db.upsert(
        key=data["unique_key"],
        values=data
    )
    return record.id

@task
def set_status(record_id: str, status: str) -> bool:
    """Idempotent: setting same status twice is fine."""
    db.update(record_id, {"status": status})
    return True

@entrypoint(checkpointer=checkpointer)
def workflow(input: dict) -> dict:
    # Idempotent - safe even if re-run
    record_id = upsert_record(input).result()
    set_status(record_id, "pending").result()

    approved = interrupt("Approve?")

    # Continue processing
    if approved:
        set_status(record_id, "approved").result()

    return {"record_id": record_id}
```

## Anti-Pattern: Side Effects in Entrypoint

```python
# WRONG: Side effect outside task
@entrypoint(checkpointer=checkpointer)
def bad_workflow(input: dict) -> dict:
    # This runs EVERY time workflow resumes!
    db.insert({"action": "started"})  # Creates duplicate records!

    result = process(input).result()
    approved = interrupt("Approve?")

    return {"result": result}

# CORRECT: Side effect in task
@task
def log_start() -> bool:
    db.insert({"action": "started"})
    return True

@entrypoint(checkpointer=checkpointer)
def good_workflow(input: dict) -> dict:
    log_start().result()  # Runs once, cached

    result = process(input).result()
    approved = interrupt("Approve?")

    return {"result": result}
```

## Summary

| Pattern | Safe? | Why |
|---------|-------|-----|
| Side effect in task | Yes | Cached on resume |
| Side effect after interrupt | Yes | Only runs after approval |
| Idempotent before interrupt | Yes | Same result if re-run |
| Non-idempotent in entrypoint | No | Re-runs on every resume |
