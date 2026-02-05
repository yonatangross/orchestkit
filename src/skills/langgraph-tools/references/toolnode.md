# ToolNode Reference

Execute tool calls from LLM responses.

## Basic Usage

```python
from langgraph.prebuilt import ToolNode
from langgraph.graph import StateGraph, START, END, MessagesState

# Define tools
@tool
def calculator(expression: str) -> str:
    """Evaluate a math expression."""
    return str(eval(expression))

@tool
def search(query: str) -> str:
    """Search for information."""
    return search_api.search(query)

tools = [calculator, search]

# Create ToolNode
tool_node = ToolNode(tools)

# Build graph
builder = StateGraph(MessagesState)
builder.add_node("agent", agent_node)
builder.add_node("tools", tool_node)

# Routing
def should_continue(state: MessagesState) -> str:
    last = state["messages"][-1]
    if last.tool_calls:
        return "tools"
    return END

builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue)
builder.add_edge("tools", "agent")

graph = builder.compile()
```

## How ToolNode Works

1. Receives state with messages
2. Extracts tool_calls from last AI message
3. Executes each tool call
4. Returns ToolMessages with results
5. Agent sees results in next invocation

## Parallel Execution

```python
# ToolNode executes multiple tool calls in parallel by default
# If agent returns 3 tool_calls, all 3 run concurrently

response = model_with_tools.invoke("Calculate 2+2 and 3+3")
# tool_calls: [calc("2+2"), calc("3+3")]

result = tool_node.invoke({"messages": [response]})
# Both calculations run in parallel
# Returns: [ToolMessage("4"), ToolMessage("6")]
```

## Error Handling

```python
# ToolNode catches exceptions and returns error messages
@tool
def risky_operation(data: str) -> str:
    """Operation that might fail."""
    if not data:
        raise ValueError("Data required")
    return process(data)

# If tool raises, ToolNode returns ToolMessage with error
# Agent can then decide how to proceed
```

## Custom ToolNode

```python
from langgraph.prebuilt import ToolNode

class CustomToolNode(ToolNode):
    """ToolNode with custom behavior."""

    async def _arun_tool(self, tool_call, config):
        # Add logging
        logger.info(f"Executing: {tool_call['name']}")

        # Call parent
        result = await super()._arun_tool(tool_call, config)

        # Add metrics
        metrics.track("tool_execution", tool_call['name'])

        return result
```

## With Streaming

```python
from langgraph.config import get_stream_writer

@tool
def long_operation(data: str) -> str:
    """Tool that streams progress."""
    writer = get_stream_writer()

    for i in range(10):
        writer({"progress": i * 10})
        process_chunk(data, i)

    return "Complete"

# Progress events visible in stream_mode="custom"
```
