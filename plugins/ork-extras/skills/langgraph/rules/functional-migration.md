---
title: Migrate from StateGraph to Functional API while preserving routing flexibility
impact: MEDIUM
impactDescription: "Migrating complex graphs with dynamic routing to Functional API loses topology flexibility"
tags: functional, migration, stategraph, conversion, refactor
---

## StateGraph to Functional API Migration

Convert simple StateGraph workflows to Functional API. Keep complex topologies as StateGraph.

**Before — Graph API:**
```python
from langgraph.graph import StateGraph

def node_a(state):
    return {"data": process(state["input"])}

def node_b(state):
    return {"result": transform(state["data"])}

graph = StateGraph(State)
graph.add_node("a", node_a)
graph.add_node("b", node_b)
graph.add_edge("a", "b")
app = graph.compile()
```

**After — Functional API:**
```python
from langgraph.func import entrypoint, task

@task
def process_data(input: str) -> str:
    return process(input)

@task
def transform_data(data: str) -> str:
    return transform(data)

@entrypoint()
def workflow(input: str) -> str:
    data = process_data(input).result()
    return transform_data(data).result()
```

**Orchestrator-worker migration:**
```python
@task
def plan(topic: str) -> list[str]:
    return planner.invoke(f"Create outline for: {topic}")

@task
def write_section(section: str) -> str:
    return llm.invoke(f"Write section: {section}")

@entrypoint()
def report_workflow(topic: str) -> str:
    sections = plan(topic).result()
    section_futures = [write_section(s) for s in sections]  # Fan-out
    completed = [f.result() for f in section_futures]         # Fan-in
    return "\n\n".join(completed)
```

**TypeScript equivalent:**
```typescript
import { entrypoint, task, MemorySaver } from "@langchain/langgraph";

const processData = task("processData", async (data: string) => transform(data));

const workflow = entrypoint(
  { name: "myWorkflow", checkpointer: new MemorySaver() },
  async (input: string) => {
    const result = await processData(input);
    return result;
  }
);
```

**When NOT to migrate:**
- Complex dynamic routing (conditional edges, semantic routing)
- Subgraph composition with different state schemas
- Graph topologies that aren't linear/tree-shaped

**Incorrect — using Graph API for simple linear workflow:**
```python
from langgraph.graph import StateGraph

def node_a(state):
    return {"data": process(state["input"])}

def node_b(state):
    return {"result": transform(state["data"])}

# Verbose for simple linear flow
graph = StateGraph(State)
graph.add_node("a", node_a)
graph.add_node("b", node_b)
graph.add_edge("a", "b")
app = graph.compile()
```

**Correct — Functional API for simple workflows:**
```python
from langgraph.func import entrypoint, task

@task
def process_data(input: str) -> str:
    return process(input)

@task
def transform_data(data: str) -> str:
    return transform(data)

@entrypoint()
def workflow(input: str) -> str:
    data = process_data(input).result()  # Clean, simple
    return transform_data(data).result()
```

**Key rules:**
- Functional API is best for sequential and orchestrator-worker patterns
- Use Graph API when you need complex topology (loops, diamonds, dynamic routing)
- Both APIs support checkpointing, streaming, and human-in-the-loop
- Futures enable implicit parallelism without explicit Send API

Reference: [LangGraph Functional API](https://langchain-ai.github.io/langgraph/concepts/functional_api/)
