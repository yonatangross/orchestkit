---
title: Drain a run with RunControl on shutdown instead of letting SIGTERM kill it mid-superstep
impact: HIGH
impactDescription: "A hard kill during a deploy abandons in-flight work with no resumable checkpoint, so the thread restarts from the last completed superstep and repeats side effects"
tags: resilience, shutdown, deployment, checkpoint, runtime
---

## Cooperative Graceful Shutdown (1.2+)

`RunControl` lets a deploy or autoscaler ask a run to stop **at a checkpoint boundary** rather than
wherever SIGTERM happened to land.

**Incorrect:**

```python
# Deploy sends SIGTERM. The process dies inside a superstep.
# Whatever the node already did externally (charged a card, sent an email)
# is not reflected in any checkpoint — the resumed thread does it again.
async def main():
    await graph.ainvoke(state, config={"configurable": {"thread_id": tid}})

signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
```

**Correct:**

```python
import asyncio
import signal
from langgraph.runtime import RunControl

async def main():
    control = RunControl()

    loop = asyncio.get_running_loop()
    loop.add_signal_handler(signal.SIGTERM, control.request_drain, "sigterm")

    await graph.ainvoke(
        state,
        config={"configurable": {"thread_id": tid}},
        context={"control": control},
    )
    # Exits at a checkpoint boundary, leaving a resumable thread behind.
```

### The control surface

| Member | Meaning |
|---|---|
| `RunControl()` | Fresh control plane. **One per run** — a control that has been drained stays drained |
| `.request_drain(reason="shutdown")` | Ask the run to wind down. Safe from any thread |
| `.drain_requested` | `bool` |
| `.drain_reason` | The string passed to `request_drain`, or `None` |

`Runtime` proxies the same signal, so a node reads it without touching the control object:

```python
async def process_batch(state: State, runtime: Runtime) -> dict:
    done = []
    for item in state["queue"]:
        if runtime.drain_requested:
            # Stop cleanly and checkpoint what finished. Do NOT start item N+1.
            return {"processed": done, "drained_at": runtime.drain_reason}
        done.append(await handle(item))
    return {"processed": done}
```

### Why "cooperative" is the whole point

Nothing preempts the node. A loop that never checks `runtime.drain_requested` runs to completion
regardless, so long-running nodes must poll it at a boundary where stopping is safe — between items,
never mid-write.

Pair it with the container's grace period: request the drain on SIGTERM, and size
`terminationGracePeriodSeconds` above the longest single item, not the longest whole run.

- Create a fresh `RunControl` per run; reusing one after `request_drain()` starts the next run drained
- Check `drain_requested` only where a partial result is a legitimate checkpoint
- Drain is not cancellation: use `timeout=` (see `resilience-node-timeouts.md`) to bound a stuck node
