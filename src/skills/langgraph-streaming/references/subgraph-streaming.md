# Subgraph Streaming Reference

Stream events from nested graph hierarchies.

## Enable Subgraph Streaming

```python
# Without subgraphs=True, only parent events are visible
for chunk in graph.stream(inputs, stream_mode="updates"):
    print(chunk)  # Only parent graph updates

# With subgraphs=True, see all levels
for namespace, chunk in graph.stream(inputs, subgraphs=True, stream_mode="updates"):
    print(f"[{namespace}] {chunk}")
```

## Namespace Structure

```python
# Namespace is a tuple showing graph hierarchy
# () = root/parent graph
# ("child",) = first-level subgraph named "child"
# ("child", "grandchild") = nested subgraph

for namespace, chunk in graph.stream(inputs, subgraphs=True, stream_mode="updates"):
    depth = len(namespace)
    path = "/".join(namespace) if namespace else "root"
    indent = "  " * depth

    print(f"{indent}[{path}] {chunk}")
```

## Output Example

```
[root] {"supervisor": {"next": "analyzer"}}
  [analyzer] {"think": {"reasoning": "..."}}
  [analyzer] {"act": {"result": "..."}}
[root] {"supervisor": {"completed": ["analyzer"]}}
  [validator] {"check": {"valid": true}}
[root] {"quality_gate": {"score": 0.95}}
```

## With Multiple Stream Modes

```python
for namespace, (mode, chunk) in graph.stream(
    inputs,
    subgraphs=True,
    stream_mode=["updates", "custom"]
):
    path = "/".join(namespace) if namespace else "root"

    if mode == "updates":
        print(f"[{path}] State: {chunk}")
    elif mode == "custom":
        print(f"[{path}] Event: {chunk}")
```

## Filtering by Subgraph

```python
for namespace, chunk in graph.stream(inputs, subgraphs=True, stream_mode="updates"):
    # Only show specific subgraph
    if "security_agent" in namespace:
        print(f"Security: {chunk}")

    # Only show leaf subgraphs (deepest level)
    if len(namespace) == 2:
        print(f"Worker: {namespace[-1]} -> {chunk}")
```

## Async Streaming

```python
async for namespace, chunk in graph.astream(
    inputs,
    subgraphs=True,
    stream_mode="updates"
):
    await process_subgraph_update(namespace, chunk)
```

## Progress Aggregation

```python
subgraph_progress = {}

for namespace, chunk in graph.stream(inputs, subgraphs=True, stream_mode="custom"):
    if chunk.get("type") == "progress":
        subgraph_name = namespace[-1] if namespace else "main"
        subgraph_progress[subgraph_name] = chunk["percentage"]

        # Calculate overall progress
        overall = sum(subgraph_progress.values()) / len(subgraph_progress)
        print(f"Overall progress: {overall:.1f}%")
```
