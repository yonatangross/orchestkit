---
title: LangGraph Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. State Management (state) — CRITICAL — 4 rules

Core state schema patterns that determine data flow between nodes. Wrong schemas cause silent data loss across workflows.

- `state-typeddict.md` — TypedDict patterns with Annotated accumulators
- `state-pydantic.md` — Pydantic validation at boundaries
- `state-messages.md` — MessagesState and add_messages reducer
- `state-reducers.md` — Custom Annotated reducers (merge, overwrite, last-value)

## 2. Routing & Branching (routing) — HIGH — 3 rules

Control flow between nodes. Missing END fallback causes workflow hangs.

- `routing-conditional.md` — Conditional edges with explicit mapping
- `routing-retry-loops.md` — Retry loop with max counter
- `routing-semantic.md` — Embedding-based and Command API routing

## 3. Parallel Execution (parallel) — HIGH — 3 rules

Concurrent node execution for performance. Requires accumulating state with reducers.

- `parallel-fanout-fanin.md` — Send API for dynamic parallel branches
- `parallel-map-reduce.md` — asyncio.gather + result aggregation
- `parallel-error-isolation.md` — Error boundaries and per-branch timeout

## 4. Supervisor Patterns (supervisor) — HIGH — 3 rules

Central coordinator routing to specialized workers. Hub-and-spoke topology.

- `supervisor-basic.md` — Command API for state update + routing
- `supervisor-priority.md` — Priority-ordered agent execution
- `supervisor-round-robin.md` — Sequential dispatch with completion tracking

## 5. Tool Calling (tools) — CRITICAL — 4 rules

LLM function calling integration. Too many tools causes context overflow and poor selection.

- `tools-bind.md` — model.bind_tools() + tool_choice options
- `tools-toolnode.md` — Prebuilt ToolNode for parallel tool execution
- `tools-dynamic.md` — Embedding-based dynamic tool selection
- `tools-interrupts.md` — interrupt() approval gates for dangerous tools

## 6. Checkpointing (checkpoints) — HIGH — 3 rules

State persistence for fault tolerance and debugging. Essential for production.

- `checkpoints-setup.md` — MemorySaver (dev) / PostgresSaver (prod)
- `checkpoints-recovery.md` — Thread-based resume and state history
- `checkpoints-store.md` — Cross-thread Store for long-term memory

## 7. Human-in-Loop (human-in-loop) — MEDIUM — 3 rules

Workflow pausing for human intervention. Requires checkpointer for state persistence.

- `human-in-loop-interrupt.md` — Dynamic interrupt() + Command(resume=)
- `human-in-loop-approval.md` — Approval gate with interrupt_before
- `human-in-loop-feedback.md` — Iterative feedback until approved

## 8. Streaming (streaming) — MEDIUM — 3 rules

Real-time updates for user-facing workflows.

- `streaming-modes.md` — 5 stream modes and when to use each
- `streaming-tokens.md` — LLM token streaming with node/tag filtering
- `streaming-custom-events.md` — get_stream_writer() for progress events

## 9. Subgraphs (subgraphs) — MEDIUM — 3 rules

Modular workflow composition with nested graphs.

- `subgraphs-invoke.md` — Different schemas, invoke from wrapper node
- `subgraphs-add-as-node.md` — Shared state, add compiled graph as node
- `subgraphs-state-mapping.md` — Explicit state transforms at boundaries

## 10. Functional API (functional) — MEDIUM — 3 rules

Decorator-based workflow construction as alternative to explicit graph building.

- `functional-entrypoint.md` — @entrypoint decorator with checkpointer
- `functional-task.md` — @task futures with .result() blocking
- `functional-migration.md` — StateGraph to Functional API conversion
