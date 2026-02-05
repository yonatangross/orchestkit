# Evaluation Test Cases

## Test 1: Fan-Out Pattern

```json
{
  "skills": ["langgraph-parallel"],
  "query": "Process a list of items in parallel with separate worker nodes",
  "expected_behavior": [
    "Uses Send() to dispatch to workers",
    "Returns list of Send objects from router",
    "Each Send includes state subset",
    "Workers run in parallel"
  ]
}
```

## Test 2: Fan-In Aggregation

```json
{
  "skills": ["langgraph-parallel"],
  "query": "Collect results from parallel workers into a single list",
  "expected_behavior": [
    "Uses Annotated[list, add] reducer",
    "Workers return partial updates",
    "Results accumulate automatically",
    "Single node receives all results"
  ]
}
```

## Test 3: Map-Reduce Pattern

```json
{
  "skills": ["langgraph-parallel"],
  "query": "Implement map-reduce: parallel processing then reduce to single output",
  "expected_behavior": [
    "Map phase uses Send() for parallelization",
    "Reduce node has edges from all workers",
    "Reduce aggregates accumulated results",
    "Single final output produced"
  ]
}
```
