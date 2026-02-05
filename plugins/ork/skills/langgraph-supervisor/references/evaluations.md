# Evaluation Test Cases

## Test 1: Basic Supervisor Setup

```json
{
  "skills": ["langgraph-supervisor"],
  "query": "Create a supervisor that coordinates two workers: analyzer and validator",
  "expected_behavior": [
    "Uses StateGraph with supervisor node",
    "Creates worker nodes for analyzer and validator",
    "Workers have edges back to supervisor",
    "Uses add_edge(START, 'supervisor') not set_entry_point()",
    "Includes END condition in routing"
  ]
}
```

## Test 2: Command API Usage

```json
{
  "skills": ["langgraph-supervisor"],
  "query": "Build a supervisor that updates state and routes in the same step",
  "expected_behavior": [
    "Imports Command from langgraph.types",
    "Supervisor returns Command with update and goto",
    "Uses Literal type annotation for type safety",
    "No conditional_edges needed when using Command"
  ]
}
```

## Test 3: Round-Robin Routing

```json
{
  "skills": ["langgraph-supervisor"],
  "query": "Implement a supervisor that visits all agents exactly once before finishing",
  "expected_behavior": [
    "Tracks completed agents in state",
    "Checks available vs completed agents",
    "Routes to quality_gate or END when all done",
    "Prevents infinite loops"
  ]
}
```
