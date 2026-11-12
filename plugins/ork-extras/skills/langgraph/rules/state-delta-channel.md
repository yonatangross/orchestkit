---
title: Store growing accumulators in a DeltaChannel so checkpoints do not re-serialize the whole value every superstep
impact: HIGH
impactDescription: "A default accumulator rewrites its entire contents into every checkpoint, so a long thread's write cost grows with history and eventually dominates run latency"
tags: state, checkpoints, performance, scale, beta
---

## DeltaChannel for Large Accumulators (1.2+, beta)

A normal `Annotated[list[X], operator.add]` channel writes its **full** value into every checkpoint.
`DeltaChannel` writes only the incremental writes and reconstructs state by replaying them through
the reducer, taking a full snapshot every Nth update.

**Incorrect:**

```python
import operator
from typing import Annotated, TypedDict

class State(TypedDict):
    # 5,000-message thread → every superstep re-serializes all 5,000 messages.
    transcript: Annotated[list[Message], operator.add]
```

**Correct:**

```python
from typing import Annotated, TypedDict
from langgraph.channels.delta import DeltaChannel

def append_all(state: list[Message], writes: Sequence[list[Message]]) -> list[Message]:
    # NOTE: writes is a BATCH of updates, not a single update.
    out = list(state)
    for w in writes:
        out.extend(w)
    return out

class State(TypedDict):
    transcript: Annotated[list[Message], DeltaChannel(append_all, snapshot_frequency=500)]
```

### The reducer contract is different from a normal reducer

```python
DeltaChannel(reducer, typ=None, *, snapshot_frequency=1000)
```

`reducer` is `(state, list_of_writes) -> new_state` — it receives a **batch**. Two properties are
mandatory, and violating either corrupts reconstructed state:

1. **Deterministic** — same inputs, same output, every replay.
2. **Batching-invariant** (associative across folds):

   ```
   reducer(reducer(state, xs), ys) == reducer(state, xs + ys)
   ```

LangGraph replays checkpointed writes in *larger batches than they were originally produced*, so a
reducer that behaves differently per batch size silently diverges on resume.

```python
# ✗ NOT batching-invariant — the cap is applied per batch, so the result
#   depends on how writes happen to be grouped on replay.
def last_n(state, writes):
    return (state + [w for batch in writes for w in batch])[-100:]
```

Trim in a node instead, where the boundary is explicit.

### Snapshot cadence

`typ` is inferred from the outer annotation, so pass only `reducer` and `snapshot_frequency`.
A full snapshot blob is written when **either** this channel reaches `snapshot_frequency` updates
(default 1000, must be a positive int) **or** the run reaches the system-wide
`DELTA_MAX_SUPERSTEPS_SINCE_SNAPSHOT` bound (default 5000) — the second bound stops a quiet channel
from accumulating unbounded replay depth.

Lower `snapshot_frequency` costs more write volume and bounds read latency; raise it for
write-heavy, rarely-resumed threads.

### Beta — read before adopting

`DeltaChannel` is explicitly **beta**. Threads written today are expected to remain readable, but the
surrounding contract is not stable: `BaseCheckpointSaver.get_delta_channel_history`, the
`_DeltaSnapshot` blob shape, and the `counters_since_delta_snapshot` metadata field may all change.

- Reach for it only when the accumulator is genuinely large; a short thread gains nothing
- Never use it for a value the graph reads on every superstep — reconstruction is not free
- Pin `langgraph` tightly while it is beta, and re-read the release notes before a minor bump
