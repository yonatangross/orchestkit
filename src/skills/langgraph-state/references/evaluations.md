# Evaluation Test Cases

## Test 1: Accumulating State

```json
{
  "skills": ["langgraph-state"],
  "query": "Design state that accumulates findings from multiple agents",
  "expected_behavior": [
    "Uses TypedDict for state schema",
    "Uses Annotated[list, add] for accumulating fields",
    "Imports operator.add for reducer",
    "Nodes return partial updates, not full state"
  ]
}
```

## Test 2: Context Schema

```json
{
  "skills": ["langgraph-state"],
  "query": "Add configuration that persists across all nodes like temperature",
  "expected_behavior": [
    "Creates context_schema dataclass",
    "Passes to StateGraph constructor",
    "Accesses via get_context() in nodes",
    "Keeps config separate from workflow state"
  ]
}
```

## Test 3: Pydantic State

```json
{
  "skills": ["langgraph-state"],
  "query": "Use Pydantic for validated state with defaults",
  "expected_behavior": [
    "Uses BaseModel instead of TypedDict",
    "Adds Field() with defaults and descriptions",
    "Enables validation on state updates",
    "Handles validation errors gracefully"
  ]
}
```
