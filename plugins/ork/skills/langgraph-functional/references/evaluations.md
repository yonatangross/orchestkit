# Evaluation Test Cases

## Test 1: Basic @task and @entrypoint

```json
{
  "skills": ["langgraph-functional"],
  "query": "Create a simple workflow using the Functional API",
  "expected_behavior": [
    "Imports entrypoint and task from langgraph.func",
    "Decorates worker functions with @task",
    "Decorates main function with @entrypoint",
    "Calls task().result() to get values"
  ]
}
```

## Test 2: Parallel Task Execution

```json
{
  "skills": ["langgraph-functional"],
  "query": "Run multiple tasks in parallel using Functional API",
  "expected_behavior": [
    "Calls multiple @task functions without .result()",
    "Tasks return futures that run in parallel",
    "Calls .result() on all futures to wait",
    "Results collected after parallel execution"
  ]
}
```

## Test 3: Injectable Parameters

```json
{
  "skills": ["langgraph-functional"],
  "query": "Access previous state and store in a @task function",
  "expected_behavior": [
    "Uses InjectedState type annotation",
    "Accesses previous checkpoint data",
    "Uses InjectedStore for persistence",
    "Parameters injected automatically by runtime"
  ]
}
```
