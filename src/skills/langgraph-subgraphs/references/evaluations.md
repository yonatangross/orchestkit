# Evaluation Test Cases

## Test 1: Invoke Pattern (Different Schemas)

```json
{
  "skills": ["langgraph-subgraphs"],
  "query": "Call a subgraph with different state schema from parent",
  "expected_behavior": [
    "Compiles subgraph separately",
    "Parent node transforms state before invoke",
    "Subgraph uses its own state schema",
    "Parent transforms subgraph output back"
  ]
}
```

## Test 2: Add-as-Node Pattern (Shared State)

```json
{
  "skills": ["langgraph-subgraphs"],
  "query": "Embed a subgraph that shares state with parent",
  "expected_behavior": [
    "Subgraph uses same state schema as parent",
    "add_node accepts compiled subgraph directly",
    "No state transformation needed",
    "Subgraph reads/writes parent state"
  ]
}
```

## Test 3: Subgraph with Checkpointing

```json
{
  "skills": ["langgraph-subgraphs"],
  "query": "Set up checkpointing that works across subgraphs",
  "expected_behavior": [
    "Only parent graph has checkpointer",
    "Uses checkpointer=False for subgraphs",
    "Subgraph state included in parent checkpoints",
    "Resume restores subgraph state"
  ]
}
```
