---
name: langgraph
license: MIT
compatibility: "Claude Code 2.1.34+."
description: LangGraph workflow patterns for state management, routing, parallel execution, supervisor-worker, tool calling, checkpointing, human-in-loop, streaming, subgraphs, and functional API. Use when building LangGraph pipelines, multi-agent systems, or AI workflows.
tags: [langgraph, workflow, state, routing, parallel, supervisor, tools, checkpoints, streaming, subgraphs, functional]
context: fork
agent: workflow-architect
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: high
metadata:
  category: document-asset-creation
---

# LangGraph Workflow Patterns

Comprehensive patterns for building production LangGraph workflows. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [State Management](#state-management) | 4 | CRITICAL | Designing workflow state schemas, accumulators, reducers |
| [Routing & Branching](#routing--branching) | 3 | HIGH | Dynamic routing, retry loops, semantic routing |
| [Parallel Execution](#parallel-execution) | 3 | HIGH | Fan-out/fan-in, map-reduce, concurrent agents |
| [Supervisor Patterns](#supervisor-patterns) | 3 | HIGH | Central coordinators, round-robin, priority dispatch |
| [Tool Calling](#tool-calling) | 4 | CRITICAL | Binding tools, ToolNode, dynamic selection, approvals |
| [Checkpointing](#checkpointing) | 3 | HIGH | Persistence, recovery, cross-thread Store memory |
| [Human-in-Loop](#human-in-loop) | 3 | MEDIUM | Approval gates, feedback loops, interrupt/resume |
| [Streaming](#streaming) | 3 | MEDIUM | Real-time updates, token streaming, custom events |
| [Subgraphs](#subgraphs) | 3 | MEDIUM | Modular composition, nested graphs, state mapping |
| [Functional API](#functional-api) | 3 | MEDIUM | @entrypoint/@task decorators, migration from StateGraph |

**Total: 32 rules across 10 categories**

## State Management

State schemas determine how data flows between nodes. Wrong schemas cause silent data loss.

| Rule | File | Key Pattern |
|------|------|-------------|
| TypedDict State | `rules/state-typeddict.md` | `TypedDict` + `Annotated[list, add]` for accumulators |
| Pydantic Validation | `rules/state-pydantic.md` | `BaseModel` at boundaries, TypedDict internally |
| MessagesState | `rules/state-messages.md` | `MessagesState` or `add_messages` reducer |
| Custom Reducers | `rules/state-reducers.md` | `Annotated[T, reducer_fn]` for merge/overwrite |

## Routing & Branching

Control flow between nodes. Always include END fallback to prevent hangs.

| Rule | File | Key Pattern |
|------|------|-------------|
| Conditional Edges | `rules/routing-conditional.md` | `add_conditional_edges` with explicit mapping |
| Retry Loops | `rules/routing-retry-loops.md` | Loop-back edges with max retry counter |
| Semantic Routing | `rules/routing-semantic.md` | Embedding similarity or `Command` API routing |

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

## Human-in-Loop

Pause workflows for human intervention. Requires checkpointer for state persistence.

| Rule | File | Key Pattern |
|------|------|-------------|
| Interrupt/Resume | `rules/human-in-loop-interrupt.md` | `interrupt()` function + `Command(resume=)` |
| Approval Gate | `rules/human-in-loop-approval.md` | `interrupt_before` + state update + resume |
| Feedback Loop | `rules/human-in-loop-feedback.md` | Iterative interrupt until approved |

## Streaming

Real-time updates and progress tracking for workflows.

| Rule | File | Key Pattern |
|------|------|-------------|
| Stream Modes | `rules/streaming-modes.md` | 5 modes: values, updates, messages, custom, debug |
| Token Streaming | `rules/streaming-tokens.md` | `messages` mode with node/tag filtering |
| Custom Events | `rules/streaming-custom-events.md` | `get_stream_writer()` for progress events |

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

- **Command API**: Use `Command(update=..., goto=...)` when updating state AND routing together
- **context_schema**: Pass runtime config (temperature, provider) without polluting state
- **CachePolicy**: Cache expensive node results with TTL via `InMemoryCache`
- **RemainingSteps**: Proactively handle recursion limits
- **Store**: Cross-thread memory separate from Checkpointer (thread-scoped)
- **interrupt()**: Dynamic interrupts inside node logic (replaces `interrupt_before` for conditional cases)
- **add_edge(START, node)**: Not `set_entry_point()` (deprecated)

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

- `agent-orchestration` - Higher-level multi-agent coordination, ReAct loop patterns, and framework comparisons
- `temporal-io` - Durable execution alternative
- `llm-integration` - General LLM function calling
- `type-safety-validation` - Pydantic model patterns
