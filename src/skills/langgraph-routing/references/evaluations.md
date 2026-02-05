# Evaluation Test Cases

## Test 1: Conditional Edge Routing

```json
{
  "skills": ["langgraph-routing"],
  "query": "Add conditional routing based on whether content needs review",
  "expected_behavior": [
    "Uses add_conditional_edges with routing function",
    "Returns string matching edge names",
    "Includes all possible routes in edge map",
    "Has fallback or END condition"
  ]
}
```

## Test 2: Retry Loop Pattern

```json
{
  "skills": ["langgraph-routing"],
  "query": "Implement a retry loop that attempts up to 3 times then fails",
  "expected_behavior": [
    "Tracks retry_count in state",
    "Routes back to retry node when count < 3",
    "Routes to failure node when count >= 3",
    "Increments counter on each retry"
  ]
}
```

## Test 3: Semantic Router

```json
{
  "skills": ["langgraph-routing"],
  "query": "Create a semantic router that classifies user intent and routes accordingly",
  "expected_behavior": [
    "Uses LLM with structured output for classification",
    "Returns valid route names",
    "Handles unknown/other category",
    "Uses Literal type for route validation"
  ]
}
```
