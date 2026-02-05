---
name: langgraph-parallel
description: LangGraph parallel execution patterns. Use when implementing fan-out/fan-in workflows, map-reduce over tasks, or running independent agents concurrently.
tags: [langgraph, parallel, concurrency, fan-out]
context: fork
agent: workflow-architect
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# LangGraph Parallel Execution

Run independent nodes concurrently for performance.

## Fan-Out/Fan-In Pattern

```python
from langgraph.graph import StateGraph

def fan_out(state):
    """Split work into parallel tasks."""
    state["tasks"] = [{"id": 1}, {"id": 2}, {"id": 3}]
    return state

def worker(state):
    """Process one task."""
    task = state["current_task"]
    result = process(task)
    return {"results": [result]}

def fan_in(state):
    """Combine parallel results."""
    combined = aggregate(state["results"])
    return {"final": combined}

workflow = StateGraph(State)
workflow.add_node("fan_out", fan_out)
workflow.add_node("worker", worker)
workflow.add_node("fan_in", fan_in)

workflow.add_edge("fan_out", "worker")
workflow.add_edge("worker", "fan_in")  # Waits for all workers
```

## Using Send API

```python
from langgraph.constants import Send

def router(state):
    """Route to multiple workers in parallel."""
    return [
        Send("worker", {"task": task})
        for task in state["tasks"]
    ]

workflow.add_conditional_edges("router", router)
```

## Complete Send API Example (2026 Pattern)

```python
from langgraph.graph import StateGraph, START, END
from langgraph.constants import Send
from typing import TypedDict, Annotated
from operator import add

class OverallState(TypedDict):
    subjects: list[str]
    jokes: Annotated[list[str], add]  # Accumulates from parallel branches

class JokeState(TypedDict):
    subject: str

def generate_topics(state: OverallState) -> dict:
    """Initial node: create list of subjects."""
    return {"subjects": ["cats", "dogs", "programming", "coffee"]}

def continue_to_jokes(state: OverallState) -> list[Send]:
    """Fan-out: create parallel branch for each subject."""
    return [
        Send("generate_joke", {"subject": s})
        for s in state["subjects"]
    ]

def generate_joke(state: JokeState) -> dict:
    """Worker: process one subject, return to accumulator."""
    joke = llm.invoke(f"Tell a short joke about {state['subject']}")
    return {"jokes": [f"{state['subject']}: {joke.content}"]}

# Build graph
builder = StateGraph(OverallState)
builder.add_node("generate_topics", generate_topics)
builder.add_node("generate_joke", generate_joke)

builder.add_edge(START, "generate_topics")
builder.add_conditional_edges("generate_topics", continue_to_jokes)
builder.add_edge("generate_joke", END)  # All branches converge automatically

graph = builder.compile()

# Invoke
result = graph.invoke({"subjects": [], "jokes": []})
# result["jokes"] contains all 4 jokes
```

## Parallel Agent Analysis

```python
from typing import Annotated
from operator import add

class AnalysisState(TypedDict):
    content: str
    findings: Annotated[list[dict], add]  # Accumulates

async def run_parallel_agents(state: AnalysisState):
    """Run multiple agents in parallel."""
    agents = [security_agent, tech_agent, quality_agent]

    # Run all concurrently
    tasks = [agent.analyze(state["content"]) for agent in agents]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter successful results
    findings = [r for r in results if not isinstance(r, Exception)]

    return {"findings": findings}
```

## Map-Reduce Pattern (True Parallel)

```python
import asyncio

async def parallel_map(items: list, process_fn) -> list:
    """Map: Process all items concurrently."""
    tasks = [asyncio.create_task(process_fn(item)) for item in items]
    return await asyncio.gather(*tasks, return_exceptions=True)

def reduce_results(results: list) -> dict:
    """Reduce: Combine all results."""
    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, Exception)]

    return {
        "total": len(results),
        "passed": len(successes),
        "failed": len(failures),
        "results": successes,
        "errors": [str(e) for e in failures]
    }

async def map_reduce_node(state: State) -> dict:
    """Combined map-reduce in single node."""
    results = await parallel_map(state["items"], process_item_async)
    summary = reduce_results(results)
    return {"summary": summary}

# Alternative: Using Send API for true parallelism in graph
def fan_out_to_mappers(state: State) -> list[Send]:
    """Fan-out pattern for parallel map."""
    return [
        Send("mapper", {"item": item, "index": i})
        for i, item in enumerate(state["items"])
    ]

# All mappers write to accumulating state key
# Reducer runs after all mappers complete (automatic fan-in)
```

## Error Isolation

```python
async def parallel_with_isolation(tasks: list):
    """Run parallel tasks, isolate failures."""
    results = await asyncio.gather(*tasks, return_exceptions=True)

    successes = []
    failures = []

    for task, result in zip(tasks, results):
        if isinstance(result, Exception):
            failures.append({"task": task, "error": str(result)})
        else:
            successes.append(result)

    return {"successes": successes, "failures": failures}
```

## Timeout per Branch

```python
import asyncio

async def parallel_with_timeout(agents: list, content: str, timeout: int = 30):
    """Run agents with per-agent timeout."""
    async def run_with_timeout(agent):
        try:
            return await asyncio.wait_for(
                agent.analyze(content),
                timeout=timeout
            )
        except asyncio.TimeoutError:
            return {"agent": agent.name, "error": "timeout"}

    tasks = [run_with_timeout(a) for a in agents]
    return await asyncio.gather(*tasks)
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Max parallel | 5-10 concurrent (avoid overwhelming APIs) |
| Error handling | return_exceptions=True (don't fail all) |
| Timeout | 30-60s per branch |
| Accumulator | Use `Annotated[list, add]` for results |

## Common Mistakes

- No error isolation (one failure kills all)
- No timeout (one slow branch blocks)
- Sequential where parallel possible
- Forgetting to wait for all branches

## Evaluations

See [references/evaluations.md](references/evaluations.md) for test cases.

## Related Skills

- `langgraph-state` - Accumulating state with `Annotated[list, add]` reducer
- `langgraph-supervisor` - Supervisor dispatching to parallel workers
- `langgraph-subgraphs` - Parallel subgraph execution
- `langgraph-streaming` - Stream progress from parallel branches
- `langgraph-checkpoints` - Checkpoint parallel execution for recovery
- `multi-agent-orchestration` - Higher-level coordination patterns

## Capability Details

### fanout-pattern
**Keywords:** fanout, parallel, concurrent, scatter
**Solves:**
- Run agents in parallel
- Implement fan-out pattern
- Distribute work across workers

### fanin-pattern
**Keywords:** fanin, gather, aggregate, collect
**Solves:**
- Aggregate parallel results
- Implement fan-in pattern
- Collect worker outputs

### parallel-template
**Keywords:** template, implementation, parallel, agent
**Solves:**
- Parallel agent fanout template
- Production-ready code
- Copy-paste implementation
