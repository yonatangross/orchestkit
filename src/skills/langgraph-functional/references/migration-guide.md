# Migration Guide: Graph API to Functional API

Convert existing StateGraph workflows to the Functional API.

## When to Migrate

**Migrate when:**
- Workflow has simple linear or branching flow
- You want cleaner Python code without graph construction
- Debugging with standard Python tools is preferred
- Parallel execution with futures is desirable

**Keep Graph API when:**
- Complex cyclic graphs (agent loops)
- Need graph visualization
- Existing infrastructure depends on graph structure

## Basic Migration

### Before: Graph API

```python
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    input: str
    processed: str
    result: str

def process_node(state: State) -> dict:
    return {"processed": transform(state["input"])}

def analyze_node(state: State) -> dict:
    return {"result": analyze(state["processed"])}

# Build graph
builder = StateGraph(State)
builder.add_node("process", process_node)
builder.add_node("analyze", analyze_node)
builder.add_edge(START, "process")
builder.add_edge("process", "analyze")
builder.add_edge("analyze", END)

graph = builder.compile(checkpointer=checkpointer)
result = graph.invoke({"input": "hello"})
```

### After: Functional API

```python
from langgraph.func import entrypoint, task

@task
def process_data(input: str) -> str:
    return transform(input)

@task
def analyze_data(processed: str) -> str:
    return analyze(processed)

@entrypoint(checkpointer=checkpointer)
def workflow(input: str) -> str:
    processed = process_data(input).result()
    result = analyze_data(processed).result()
    return result

result = workflow.invoke("hello")
```

## State to Parameters

### Before: Shared State

```python
class State(TypedDict):
    query: str
    context: dict
    results: list
    final: str

def node_a(state):
    return {"results": search(state["query"])}

def node_b(state):
    return {"final": summarize(state["results"])}
```

### After: Function Parameters

```python
@task
def search_task(query: str) -> list:
    return search(query)

@task
def summarize_task(results: list) -> str:
    return summarize(results)

@entrypoint(checkpointer=checkpointer)
def workflow(query: str) -> str:
    results = search_task(query).result()
    final = summarize_task(results).result()
    return final
```

## Conditional Routing

### Before: Conditional Edges

```python
def router(state):
    if state["score"] > 0.8:
        return "approve"
    return "reject"

builder.add_conditional_edges("evaluate", router)
```

### After: Python If/Else

```python
@entrypoint(checkpointer=checkpointer)
def workflow(input: dict) -> dict:
    score = evaluate(input).result()

    if score > 0.8:
        result = approve_flow(input).result()
    else:
        result = reject_flow(input).result()

    return result
```

## Parallel Execution

### Before: Send API

```python
def fan_out(state):
    return [Send("worker", {"item": i}) for i in state["items"]]
```

### After: Parallel Futures

```python
@entrypoint(checkpointer=checkpointer)
def workflow(items: list) -> list:
    # Launch all in parallel
    futures = [process_item(item) for item in items]

    # Collect results
    results = [f.result() for f in futures]

    return results
```

## Human-in-the-Loop

### Before: interrupt_before

```python
app = builder.compile(
    checkpointer=checkpointer,
    interrupt_before=["review"]
)
```

### After: interrupt() Function

```python
from langgraph.types import interrupt

@entrypoint(checkpointer=checkpointer)
def workflow(input: dict) -> dict:
    draft = generate(input).result()

    # Dynamic interrupt
    approved = interrupt({
        "action": "review",
        "draft": draft
    })

    if approved:
        return publish(draft).result()
    return {"status": "rejected"}
```

## Checklist

- [ ] Convert nodes to @task functions
- [ ] Convert graph to @entrypoint function
- [ ] Replace shared state with function parameters
- [ ] Replace conditional edges with Python if/else
- [ ] Replace Send API with parallel futures
- [ ] Replace interrupt_before with interrupt() calls
- [ ] Add checkpointer to @entrypoint decorator
- [ ] Test resume behavior
