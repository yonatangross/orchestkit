---
title: Bound every node attempt with timeout= instead of letting a hung call stall the graph forever
impact: CRITICAL
impactDescription: "A node awaiting an unresponsive API blocks its superstep indefinitely — the run never fails, never retries, and never checkpoints past that node"
tags: resilience, timeout, fault-tolerance, retry, async
---

## Per-Node Timeouts (1.2+)

`add_node(..., timeout=)` caps a single node **attempt**. When it fires, LangGraph raises
`NodeTimeoutError`, discards that attempt's writes, and hands off to the node's retry policy.

**Incorrect:**

```python
async def call_vendor(state: State) -> dict:
    # No bound. If the vendor hangs, this superstep never completes and the
    # retry policy never engages — there is no failure for it to react to.
    resp = await httpx.AsyncClient().post(VENDOR_URL, json=state["payload"])
    return {"result": resp.json()}

builder.add_node("call_vendor", call_vendor, retry_policy=RetryPolicy(max_attempts=3))
```

**Correct:**

```python
from langgraph.types import RetryPolicy, TimeoutPolicy

# Scalar shorthand: hard wall-clock cap in seconds.
builder.add_node("call_vendor", call_vendor, timeout=30)

# Full policy: a hard cap AND an idle cap that resets on progress.
builder.add_node(
    "stream_summary",
    stream_summary,
    timeout=TimeoutPolicy(
        run_timeout=300,     # never refreshed — absolute ceiling for one attempt
        idle_timeout=30,     # refreshed by progress signals
        refresh_on="auto",   # or "heartbeat" to count ONLY explicit heartbeats
    ),
    retry_policy=RetryPolicy(max_attempts=3),
)
```

`timeout` accepts `float | timedelta | TimeoutPolicy`.

### Choosing run_timeout vs idle_timeout

| Node shape | Use |
|---|---|
| Single bounded request | `run_timeout` alone |
| Token stream / long generation | `idle_timeout` — a healthy stream keeps refreshing it |
| Long job that must still end | both — `idle_timeout` catches stalls, `run_timeout` caps total |

### Heartbeats for work the graph cannot observe

Under `refresh_on="heartbeat"`, only explicit calls refresh the idle clock:

```python
async def long_batch(state: State, runtime: Runtime) -> dict:
    for chunk in state["chunks"]:
        await process(chunk)
        runtime.heartbeat()   # "still making progress"
    return {"done": True}
```

### Timeouts are cooperative — this is the trap

Timeouts ride on asyncio cancellation. A node doing **synchronous** CPU-bound work or `time.sleep()`
holds the GIL, so the timeout cannot fire until the event loop is released:

```python
# ✗ timeout= will NOT interrupt this — it blocks the loop
def crunch(state: State) -> dict:
    time.sleep(600)
    return {}

# ✓ yields to the loop, so the timeout can fire
async def crunch(state: State) -> dict:
    await asyncio.sleep(600)
    return {}

# ✓ CPU-bound work belongs off the loop
async def crunch(state: State) -> dict:
    return await asyncio.to_thread(blocking_crunch, state["data"])
```

### Inspecting the failure

`NodeTimeoutError` (from `langgraph.errors`) carries `node`, `timeout`, `run_timeout`,
`idle_timeout`, `elapsed`, and `kind` (`"idle"` or `"run"`) — enough to alert on *which* bound blew
without parsing a message string.

- Prefer a timeout on every node that performs I/O; a retry policy without one is not a safety net
- Set `run_timeout` above p99 latency, not above the mean, or retries amplify load during a slowdown
