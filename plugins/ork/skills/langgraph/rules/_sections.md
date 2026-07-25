---
title: LangGraph Rule Categories
version: 3.0.0
---

# Rule Categories

**41 rules across 12 categories.** Every rule file in this directory is listed below; if you add one,
add it here and update the Quick Reference table in `SKILL.md` in the same change.

## 1. State Management (state) — CRITICAL — 5 rules

Core state schema patterns that determine data flow between nodes. Wrong schemas cause silent data loss across workflows.

- `state-typeddict.md` — TypedDict patterns with Annotated accumulators
- `state-pydantic.md` — Pydantic validation at boundaries
- `state-messages.md` — MessagesState and add_messages reducer
- `state-reducers.md` — Custom Annotated reducers (merge, overwrite, last-value)
- `state-delta-channel.md` — DeltaChannel for large accumulators (1.2, beta); batch reducer must be batching-invariant

## 2. Resilience (resilience) — CRITICAL — 3 rules

Fault tolerance for nodes that touch the outside world. New in 1.2: before it, `retry_policy` was the only lever, and it cannot help a node that never fails because it never returns.

- `resilience-node-timeouts.md` — `timeout=` / `TimeoutPolicy(run_timeout=, idle_timeout=, refresh_on=)`, `NodeTimeoutError`, `runtime.heartbeat()`
- `resilience-error-handlers.md` — `error_handler=` recovery node, parameter typed `NodeError`, returns `Command`
- `resilience-graceful-drain.md` — `RunControl.request_drain()` and `runtime.drain_requested` for shutdown at a checkpoint boundary

## 3. Routing & Branching (routing) — HIGH — 4 rules

Control flow between nodes. Missing END fallback causes workflow hangs.

- `routing-conditional.md` — Conditional edges with explicit mapping
- `routing-retry-loops.md` — Framework-native retry (`retry_policy`/`timeout`/`error_handler`), manual counter as the pre-1.2 fallback
- `routing-semantic.md` — Embedding-based and Command API routing
- `routing-cross-graph.md` — `Command(graph=...)` for parent/sibling subgraph navigation

## 4. Parallel Execution (parallel) — HIGH — 3 rules

Concurrent node execution for performance. Requires accumulating state with reducers.

- `parallel-fanout-fanin.md` — Send API for dynamic parallel branches
- `parallel-map-reduce.md` — asyncio.gather + result aggregation
- `parallel-error-isolation.md` — Error boundaries and per-branch timeout

## 5. Supervisor Patterns (supervisor) — HIGH — 3 rules

Central coordinator routing to specialized workers. Hub-and-spoke topology.

- `supervisor-basic.md` — Command API for state update + routing
- `supervisor-priority.md` — Priority-ordered agent execution
- `supervisor-round-robin.md` — Sequential dispatch with completion tracking

## 6. Tool Calling (tools) — CRITICAL — 4 rules

LLM function calling integration. Too many tools causes context overflow and poor selection.

- `tools-bind.md` — model.bind_tools() + tool_choice options
- `tools-toolnode.md` — Prebuilt ToolNode for parallel tool execution
- `tools-dynamic.md` — Embedding-based dynamic tool selection
- `tools-interrupts.md` — interrupt() approval gates for dangerous tools

## 7. Checkpointing (checkpoints) — HIGH — 3 rules

State persistence for fault tolerance and debugging. Essential for production.

- `checkpoints-setup.md` — MemorySaver (dev) / PostgresSaver (prod)
- `checkpoints-recovery.md` — Thread-based resume and state history
- `checkpoints-store.md` — Cross-thread Store for long-term memory

## 8. Human-in-Loop (human-in-loop) — MEDIUM — 3 rules

Workflow pausing for human intervention. Requires checkpointer for state persistence.

- `human-in-loop-interrupt.md` — Dynamic interrupt() + Command(resume=)
- `human-in-loop-approval.md` — Approval gate with interrupt_before
- `human-in-loop-feedback.md` — Iterative feedback until approved

## 9. Streaming (streaming) — MEDIUM — 4 rules

Real-time updates for user-facing workflows.

- `streaming-modes.md` — 5 stream modes and when to use each
- `streaming-tokens.md` — LLM token streaming with node/tag filtering
- `streaming-custom-events.md` — get_stream_writer() for progress events
- `streaming-v2-format.md` — Opt-in `version="v2"` type-safe streaming output

## 10. Subgraphs (subgraphs) — MEDIUM — 3 rules

Modular workflow composition with nested graphs.

- `subgraphs-invoke.md` — Different schemas, invoke from wrapper node
- `subgraphs-add-as-node.md` — Shared state, add compiled graph as node
- `subgraphs-state-mapping.md` — Explicit state transforms at boundaries

## 11. Functional API (functional) — MEDIUM — 3 rules

Decorator-based workflow construction as alternative to explicit graph building.

- `functional-entrypoint.md` — @entrypoint decorator with checkpointer
- `functional-task.md` — @task futures with .result() blocking
- `functional-migration.md` — StateGraph to Functional API conversion

## 12. Platform (platform) — HIGH — 3 rules

Deploying and calling graphs that run somewhere other than your process.

- `platform-deployment.md` — Local dev, Docker builds, and cloud deployment config
- `platform-remote-graph.md` — `RemoteGraph` to invoke a deployed instance from client code
- `platform-double-texting.md` — Concurrent-message (double-texting) strategies
