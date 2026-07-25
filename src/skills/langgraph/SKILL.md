---
name: langgraph
license: MIT
compatibility: "Claude Code 2.1.206+."
description: LangGraph 1.x (LTS) Python workflow patterns for state management, delta channels, resilience (node timeouts, error handlers, graceful drain), routing, parallel execution, supervisor-worker, tool calling, checkpointing, human-in-loop, streaming (v2 format), subgraphs, and functional API. Use when building LangGraph pipelines, multi-agent systems, or AI workflows.
tags: [langgraph, workflow, state, delta-channel, resilience, timeout, routing, parallel, supervisor, tools, checkpoints, streaming, streaming-v2, subgraphs, functional, lts, python]
context: fork
agent: workflow-architect
version: 2.3.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: high
persuasion-type: reference
effort: high
targets:
  # Python only. The JS package `@langchain/langgraph` is on its own faster line (1.4.x as of
  # 2026-07) and every rule here is Python — declaring a JS floor advertised coverage this skill
  # does not have. Re-add it only alongside real TypeScript rules.
  - library: "langgraph"
    version: ">=1.2.0"
upstream-version-tested: "1.2.9"
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# LangGraph Workflow Patterns

Comprehensive patterns for building production LangGraph workflows. **LangGraph 1.x is LTS** (Long Term Support) — the first stable major release, powering agents at Uber, LinkedIn, and Klarna. Each category has individual rule files in `rules/` loaded on-demand.

> **LangGraph 1.2 (shipped 2026-05-12) — the fault-tolerance release.** Everything below is on
> `StateGraph.add_node(...)` unless noted:
>
> - **Per-node timeouts** — `timeout=` accepts `float | timedelta | TimeoutPolicy`.
>   `TimeoutPolicy(run_timeout=, idle_timeout=, refresh_on="auto"|"heartbeat")` separates a hard
>   wall-clock cap from an idle cap that progress refreshes. On expiry LangGraph raises
>   `NodeTimeoutError` (carrying `kind="idle"|"run"` and `elapsed`), drops that attempt's writes, and
>   defers to the retry policy. Cooperative: it rides asyncio cancellation, so a node blocking the
>   GIL is *not* interrupted. See `rules/resilience-node-timeouts.md`.
> - **Node error handlers** — `error_handler=` registers a recovery node that runs once the retry
>   budget is exhausted. It receives failure context by declaring a parameter typed `NodeError`
>   (fields `node`, `error`) and returns a `Command` to update state and reroute.
>   See `rules/resilience-error-handlers.md`.
> - **`RunControl`** (`langgraph.runtime`) — cooperative graceful shutdown. `request_drain(reason)`
>   from any thread; nodes poll `runtime.drain_requested` and stop at a checkpoint boundary, leaving
>   a resumable thread instead of a half-applied superstep. See `rules/resilience-graceful-drain.md`.
> - **`DeltaChannel`** (`langgraph.channels.delta`, **beta**) — checkpoints store only incremental
>   writes and replay them through a batch reducer, with a snapshot every `snapshot_frequency`
>   updates. Fixes checkpoint cost growing with thread length. Its reducer takes a *batch* and must
>   be batching-invariant. See `rules/state-delta-channel.md`.
> - **`runtime.heartbeat()`** — explicit progress signal, the only one that refreshes an idle timeout
>   under `refresh_on="heartbeat"`.
>
> **Landed earlier, in 1.1 — not 1.2** (they are current and supported; only their release
> attribution was wrong in prior versions of this skill): deferred nodes (`defer=True`), node-level
> caching (`CachePolicy` + `graph.compile(cache=...)`), and model middleware
> (`before_model` / `after_model`) on `create_agent`.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [State Management](#state-management) | 5 | CRITICAL | Designing workflow state schemas, accumulators, reducers, delta channels |
| [Resilience](#resilience) | 3 | CRITICAL | Node timeouts, error handlers, graceful drain (1.2+) |
| [Routing & Branching](#routing--branching) | 4 | HIGH | Dynamic routing, retry loops, semantic routing, cross-graph |
| [Parallel Execution](#parallel-execution) | 3 | HIGH | Fan-out/fan-in, map-reduce, concurrent agents |
| [Supervisor Patterns](#supervisor-patterns) | 3 | HIGH | Central coordinators, round-robin, priority dispatch |
| [Tool Calling](#tool-calling) | 4 | CRITICAL | Binding tools, ToolNode, dynamic selection, approvals |
| [Checkpointing](#checkpointing) | 3 | HIGH | Persistence, recovery, cross-thread Store memory |
| [Human-in-Loop](#human-in-loop) | 3 | MEDIUM | Approval gates, feedback loops, interrupt/resume |
| [Streaming](#streaming) | 3 | MEDIUM | Real-time updates, token streaming, custom events |
| [Subgraphs](#subgraphs) | 3 | MEDIUM | Modular composition, nested graphs, state mapping |
| [Functional API](#functional-api) | 3 | MEDIUM | @entrypoint/@task decorators, migration from StateGraph |
| [Platform](#platform) | 3 | HIGH | Deployment, RemoteGraph, double-texting strategies |

**Total: 41 rules across 12 categories**

## State Management

State schemas determine how data flows between nodes. Wrong schemas cause silent data loss.

| Rule | File | Key Pattern |
|------|------|-------------|
| TypedDict State | `rules/state-typeddict.md` | `TypedDict` + `Annotated[list, add]` for accumulators |
| Pydantic Validation | `rules/state-pydantic.md` | `BaseModel` at boundaries, TypedDict internally |
| MessagesState | `rules/state-messages.md` | `MessagesState` or `add_messages` reducer |
| Custom Reducers | `rules/state-reducers.md` | `Annotated[T, reducer_fn]` for merge/overwrite |
| Delta Channels (1.2, beta) | `rules/state-delta-channel.md` | `DeltaChannel(reducer, snapshot_frequency=)` for large accumulators |

## Resilience

Fault tolerance for nodes that talk to the outside world. New in 1.2 — before it, the only lever was
`retry_policy`, which cannot help a node that never fails because it never returns.

| Rule | File | Key Pattern |
|------|------|-------------|
| Node Timeouts | `rules/resilience-node-timeouts.md` | `add_node(..., timeout=TimeoutPolicy(run_timeout=, idle_timeout=))` |
| Error Handlers | `rules/resilience-error-handlers.md` | `add_node(..., error_handler=)` + param typed `NodeError` → `Command` |
| Graceful Drain | `rules/resilience-graceful-drain.md` | `RunControl().request_drain()` + `runtime.drain_requested` |

```python
from langgraph.types import RetryPolicy, TimeoutPolicy
from langgraph.errors import NodeError

builder.add_node(
    "call_vendor",
    call_vendor,
    timeout=TimeoutPolicy(run_timeout=300, idle_timeout=30),
    retry_policy=RetryPolicy(max_attempts=3),
    error_handler=lambda state, error: Command(
        update={"failure": f"{error.node}: {error.error}"}, goto="degraded_path"
    ),
)
```

## Routing & Branching

Control flow between nodes. Always include END fallback to prevent hangs.

| Rule | File | Key Pattern |
|------|------|-------------|
| Conditional Edges | `rules/routing-conditional.md` | `add_conditional_edges` with explicit mapping |
| Retry Loops | `rules/routing-retry-loops.md` | Loop-back edges with max retry counter |
| Semantic Routing | `rules/routing-semantic.md` | Embedding similarity or `Command` API routing |
| Cross-Graph Navigation | `rules/routing-cross-graph.md` | `Command(graph=Command.PARENT)` for parent/sibling routing |

## Parallel Execution

Run independent nodes concurrently. Use `Annotated[list, add]` to accumulate results.

| Rule | File | Key Pattern |
|------|------|-------------|
| Fan-Out/Fan-In | `rules/parallel-fanout-fanin.md` | `Send` API for dynamic parallel branches |
| Map-Reduce | `rules/parallel-map-reduce.md` | `asyncio.gather` + result aggregation |
| Error Isolation | `rules/parallel-error-isolation.md` | `return_exceptions=True` + per-branch timeout |

## Supervisor Patterns

Central coordinator routes to specialized workers. Workers return to supervisor.

| Rule | File | Key Pattern |
|------|------|-------------|
| Basic Supervisor | `rules/supervisor-basic.md` | `Command` API for state update + routing |
| Priority Routing | `rules/supervisor-priority.md` | Priority dict ordering agent execution |
| Round-Robin | `rules/supervisor-round-robin.md` | Completion tracking with `agents_completed` |

## Tool Calling

Integrate function calling into LangGraph agents. Keep tools under 10 per agent.

| Rule | File | Key Pattern |
|------|------|-------------|
| Tool Binding | `rules/tools-bind.md` | `model.bind_tools(tools)` + `tool_choice` |
| ToolNode Execution | `rules/tools-toolnode.md` | `ToolNode(tools)` prebuilt parallel executor |
| Dynamic Selection | `rules/tools-dynamic.md` | Embedding-based tool relevance filtering |
| Tool Interrupts | `rules/tools-interrupts.md` | `interrupt()` for approval gates on tools |

## Checkpointing

Persist workflow state for recovery and debugging.

| Rule | File | Key Pattern |
|------|------|-------------|
| Checkpointer Setup | `rules/checkpoints-setup.md` | `MemorySaver` dev / `PostgresSaver` prod |
| State Recovery | `rules/checkpoints-recovery.md` | `thread_id` resume + `get_state_history` |
| Cross-Thread Store | `rules/checkpoints-store.md` | `Store` for long-term memory across threads |

## Node-Level Caching (1.2+)

Independent of checkpointing. Cache individual node output so re-runs with identical inputs skip execution entirely.

```python
from langgraph.graph import StateGraph
from langgraph.types import CachePolicy
from langgraph.cache.sqlite import SqliteCache

graph = StateGraph(State)
graph.add_node(
    "expensive_fetch",
    fetch_fn,
    cache_policy=CachePolicy(ttl=3600, key_func=lambda s: s["query"]),
)
# RedisCache(url=...) for distributed workers
compiled = graph.compile(cache=SqliteCache("cache.db"))
```

Use when a node is idempotent and expensive (embeddings, external APIs). Do **not** use for nodes whose output depends on wall-clock time or mutable external state unless `key_func` captures that variance.

## Deferred Nodes & Model Middleware (1.2+)

```python
# defer=True — node execution is deferred until the run is about to end,
# i.e. after every other upstream node has completed
graph.add_node("aggregate", aggregate_fn, defer=True)

# Model middleware — no subclassing required.
# create_react_agent is @deprecated since v1.0; use create_agent from langchain.agents.
# The legacy pre_model_hook/post_model_hook are now before_model/after_model middleware.
from langchain.agents import create_agent

agent = create_agent(
    model=model,
    tools=tools,
    middleware=[compress_history, redact_pii],  # before_model / after_model hooks
    system_prompt="...",                          # prompt= renamed to system_prompt
)
```

## Human-in-Loop

Pause workflows for human intervention. Requires checkpointer for state persistence.

| Rule | File | Key Pattern |
|------|------|-------------|
| Interrupt/Resume | `rules/human-in-loop-interrupt.md` | `interrupt()` function + `Command(resume=)` |
| Approval Gate | `rules/human-in-loop-approval.md` | `interrupt_before` + state update + resume |
| Feedback Loop | `rules/human-in-loop-feedback.md` | Iterative interrupt until approved |

## Streaming

Real-time updates and progress tracking for workflows. **LangGraph 1.2 supports `version="v2"`** (introduced in 1.1), an opt-in streaming format with full type safety on `stream()`, `astream()`, `invoke()`, and `ainvoke()`.

| Rule | File | Key Pattern |
|------|------|-------------|
| Stream Modes | `rules/streaming-modes.md` | 5 modes: values, updates, messages, custom, debug |
| Token Streaming | `rules/streaming-tokens.md` | `messages` mode with node/tag filtering |
| Custom Events | `rules/streaming-custom-events.md` | `get_stream_writer()` for progress events |
| Streaming v2 | `rules/streaming-v2-format.md` | `version="v2"` for typed streaming (LG 1.1+) |

## Subgraphs

Compose modular, reusable workflow components with nested graphs.

| Rule | File | Key Pattern |
|------|------|-------------|
| Invoke from Node | `rules/subgraphs-invoke.md` | Different schemas, explicit state mapping |
| Add as Node | `rules/subgraphs-add-as-node.md` | Shared state, `add_node(name, compiled_graph)` |
| State Mapping | `rules/subgraphs-state-mapping.md` | Boundary transforms between parent/child |

## Functional API

Build workflows using `@entrypoint` and `@task` decorators instead of explicit graph construction.

| Rule | File | Key Pattern |
|------|------|-------------|
| @entrypoint | `rules/functional-entrypoint.md` | Workflow entry point with optional checkpointer |
| @task | `rules/functional-task.md` | Returns futures, `.result()` to block |
| Migration | `rules/functional-migration.md` | `StateGraph` to Functional API conversion |

## Platform

Deploy graphs as managed APIs with persistence, streaming, and multi-tenancy.

| Rule | File | Key Pattern |
|------|------|-------------|
| Deployment | `rules/platform-deployment.md` | `langgraph.json` + CLI + Assistants API |
| RemoteGraph | `rules/platform-remote-graph.md` | `RemoteGraph` for calling deployed graphs |
| Double Texting | `rules/platform-double-texting.md` | 4 strategies: reject, rollback, enqueue, interrupt |

## Quick Start Example

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command
from typing import TypedDict, Annotated, Literal
from operator import add

class State(TypedDict):
    input: str
    results: Annotated[list[str], add]

def supervisor(state) -> Command[Literal["worker", END]]:
    if not state.get("results"):
        return Command(update={"input": state["input"]}, goto="worker")
    return Command(goto=END)

def worker(state) -> dict:
    return {"results": [f"Processed: {state['input']}"]}

graph = StateGraph(State)
graph.add_node("supervisor", supervisor)
graph.add_node("worker", worker)
graph.add_edge(START, "supervisor")
graph.add_edge("worker", "supervisor")
app = graph.compile()
```

## 2026 Key Patterns

- **Streaming v2 (LG 1.1)**: Use `version="v2"` for type-safe streaming — fully typed `stream()` and `astream()` returns. Default remains `"v1"` for backwards compat.
- **Command API**: Use `Command(update=..., goto=...)` when updating state AND routing together
- **context_schema**: Pass runtime config (temperature, provider) without polluting state
- **CachePolicy**: Cache expensive node results with TTL via `SqliteCache` (prod) or `InMemoryCache` from `langgraph.cache.memory` (dev)
- **RemainingSteps**: Proactively handle recursion limits
- **Store**: Cross-thread memory separate from Checkpointer (thread-scoped)
- **interrupt()**: Dynamic interrupts inside node logic (replaces `interrupt_before` for conditional cases)
- **add_edge(START, node)**: Not `set_entry_point()` (deprecated)
- **LTS release**: LangGraph 1.x is LTS — will remain ACTIVE until v2.0

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| State type | TypedDict internally, Pydantic at boundaries |
| Entry point | `add_edge(START, node)` not `set_entry_point()` |
| Routing + state update | Command API |
| Routing only | Conditional edges |
| Accumulators | `Annotated[list[T], add]` always |
| Dev checkpointer | MemorySaver |
| Prod checkpointer | PostgresSaver |
| Short-term memory | Checkpointer (thread-scoped) |
| Long-term memory | Store (cross-thread, namespaced) |
| Max parallel branches | 5-10 concurrent |
| Tools per agent | 5-10 max (dynamic selection for more) |
| Approval gates | `interrupt()` for high-risk operations |
| Stream modes | `["updates", "custom"]` for most UIs |
| Subgraph pattern | Invoke for isolation, Add-as-Node for shared state |
| Functional vs Graph | Functional for simple flows, Graph for complex topology |

## Common Mistakes

1. Forgetting `add` reducer (overwrites instead of accumulates)
2. Mutating state in place (breaks checkpointing)
3. No END fallback in routing (workflow hangs)
4. Infinite retry loops (no max counter)
5. Side effects in router functions
6. Too many tools per agent (context overflow)
7. Raising exceptions in tools (crashes agent loop)
8. No checkpointer in production (lose progress on crash)
9. Wrapping `interrupt()` in try/except (breaks the mechanism)
10. Not transforming state at subgraph boundaries
11. Forgetting `.result()` on Functional API tasks
12. Using `set_entry_point()` (deprecated, use `add_edge(START, ...)`)

## Evaluations

See `test-cases.json` for consolidated test cases across all categories.

## Related Skills

- `ork:agent-orchestration` - Higher-level multi-agent coordination, ReAct loop patterns, and framework comparisons
- `temporal-io` - Durable execution alternative
- `ork:llm-integration` - General LLM function calling
- `type-safety-validation` - Pydantic model patterns
