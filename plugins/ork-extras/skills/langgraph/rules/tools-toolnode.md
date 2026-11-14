---
title: Use ToolNode for automatic parallel tool execution with built-in error handling
impact: CRITICAL
impactDescription: "Manual tool dispatch misses parallel execution and error handling that ToolNode provides"
tags: tools, toolnode, prebuilt, execution, parallel
---

## ToolNode Execution

Use `ToolNode` for automatic tool execution with parallel support and error handling.

**Incorrect — manual tool dispatch:**
```python
def execute_tools(state):
    last_message = state["messages"][-1]
    results = []
    for tool_call in last_message.tool_calls:
        # Manual dispatch — sequential, no error handling
        tool = tools_dict[tool_call["name"]]
        result = tool.invoke(tool_call["args"])
        results.append(result)
    return {"messages": results}
```

**Correct — ToolNode handles everything:**
```python
from langgraph.prebuilt import ToolNode
from langgraph.graph import StateGraph, START, END, MessagesState

tool_node = ToolNode(tools)  # Parallel execution built-in

builder = StateGraph(MessagesState)
builder.add_node("agent", agent_node)
builder.add_node("tools", tool_node)

def should_continue(state) -> str:
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return END

builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
builder.add_edge("tools", "agent")  # Return to agent after tool execution

graph = builder.compile()
```

**Key rules:**
- `ToolNode` executes multiple tool calls in parallel automatically
- Results returned in order matching the original tool_calls
- Always add `tools → agent` edge for the ReAct loop
- Route based on `tool_calls` presence in last message

Reference: [LangGraph ToolNode](https://langchain-ai.github.io/langgraph/concepts/agentic_concepts/#tool-calling-agent)
