# Evaluation Test Cases

## Test 1: Tool Binding

```json
{
  "skills": ["langgraph-tools"],
  "query": "Bind tools to an LLM and create a ToolNode for execution",
  "expected_behavior": [
    "Uses @tool decorator for tool functions",
    "Calls llm.bind_tools(tools) for binding",
    "Creates ToolNode(tools) for execution",
    "Adds agent node and tool node to graph"
  ]
}
```

## Test 2: Tool Approval Gate

```json
{
  "skills": ["langgraph-tools"],
  "query": "Add human approval before executing a delete tool",
  "expected_behavior": [
    "Uses interrupt() inside tool function",
    "Shows action details in interrupt payload",
    "Checks approval response before executing",
    "Returns cancelled message if rejected"
  ]
}
```

## Test 3: Dynamic Tool Selection

```json
{
  "skills": ["langgraph-tools"],
  "query": "Select different tools based on user permissions",
  "expected_behavior": [
    "Reads user permissions from state",
    "Filters available tools based on permissions",
    "Binds only allowed tools to LLM",
    "Handles case where no tools available"
  ]
}
```
