---
title: Handle concurrent user messages with double-texting strategies
impact: MEDIUM
impactDescription: "Without double-texting config, concurrent messages cause race conditions — corrupted state or lost inputs"
tags: platform, double-texting, concurrency, reject, rollback, enqueue, interrupt
---

## Double Texting

When a user sends a new message while a previous run is still executing, LangGraph Platform provides four strategies to handle the conflict.

**Problem — no strategy (race condition):**
```
User: "Analyze Q1 data"     → Run starts...
User: "Actually use Q2 data" → Second run starts on same thread
# Both runs mutate state concurrently — corrupted results
```

**Strategy 1 — Reject (simplest, safest):**
```python
from langgraph_sdk import get_client

client = get_client(url="http://localhost:2024")

# New input rejected while run is active
run = await client.runs.create(
    thread_id=thread["thread_id"],
    assistant_id="my_agent",
    input={"messages": [{"role": "user", "content": "Analyze Q2"}]},
    multitask_strategy="reject",
)
# Raises 409 Conflict if a run is already active
```
**Use case:** Strict turn-based workflows, form submissions, payment processing.

**Strategy 2 — Rollback (cancel and restart):**
```python
# Cancel current run, roll back state, start fresh with new input
run = await client.runs.create(
    thread_id=thread["thread_id"],
    assistant_id="my_agent",
    input={"messages": [{"role": "user", "content": "Use Q2 data instead"}]},
    multitask_strategy="rollback",
)
# Previous run cancelled, state rolled back to before it started
```
**Use case:** Chatbots where user corrections should override in-progress work.

**Strategy 3 — Enqueue (process sequentially):**
```python
# Queue new input to run after current run completes
run = await client.runs.create(
    thread_id=thread["thread_id"],
    assistant_id="my_agent",
    input={"messages": [{"role": "user", "content": "Also check Q3"}]},
    multitask_strategy="enqueue",
)
# Runs sequentially: current run finishes, then queued run starts
```
**Use case:** Task queues, sequential pipelines, batch processing interfaces.

**Strategy 4 — Interrupt (stop and continue):**
```python
# Interrupt current run but keep its state, then continue with new input
run = await client.runs.create(
    thread_id=thread["thread_id"],
    assistant_id="my_agent",
    input={"messages": [{"role": "user", "content": "Focus on revenue"}]},
    multitask_strategy="interrupt",
)
# Current run stops mid-execution, new run builds on existing state
```
**Use case:** Interactive agents where context should accumulate across interruptions.

**Key rules:**
- Set `multitask_strategy` on every `runs.create` call (no global default)
- `reject` — safest, returns 409 if busy; client must retry
- `rollback` — cancels active run, resets state, starts new run
- `enqueue` — queues new run after current completes; preserves ordering
- `interrupt` — stops active run mid-execution, keeps partial state, starts new run
- Choose based on UX: corrections → rollback, queuing → enqueue, strict → reject
- Only relevant for same-thread concurrent runs; different threads are independent

Reference: [Double Texting](https://langchain-ai.github.io/langgraph/concepts/double_texting/)
