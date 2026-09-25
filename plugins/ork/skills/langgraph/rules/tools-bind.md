---
title: Bind tools to LLMs correctly with proper tool_choice to ensure invocation
impact: CRITICAL
impactDescription: "Unbinding tools or wrong tool_choice causes LLM to ignore available tools entirely"
tags: tools, bind_tools, function-calling, tool_choice
---

## Tool Binding to LLMs

Bind tools to models with `bind_tools()`. Use `tool_choice` to control selection.

**Incorrect — tools defined but not bound:**
```python
@tool
def search_database(query: str) -> str:
    """Search the database."""
    return db.search(query)

def agent_node(state):
    response = model.invoke(state["messages"])  # Model doesn't know about tools!
    return {"messages": [response]}
```

**Correct — tools bound to model:**
```python
from langchain_core.tools import tool
from langchain_anthropic import ChatAnthropic

@tool
def search_database(query: str) -> str:
    """Search the database for information."""
    return db.search(query)

@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to a recipient."""
    email_service.send(to, subject, body)
    return f"Email sent to {to}"

tools = [search_database, send_email]
model = ChatAnthropic(model="claude-sonnet-5")
model_with_tools = model.bind_tools(tools)

def agent_node(state):
    response = model_with_tools.invoke(state["messages"])
    return {"messages": [response]}
```

**Require a tool call:**
```python
# Opus 5.5, Fable 5.1 and Mythos 5.1: forced tool_choice ("any" or a named tool) returns a 400.
# Use auto (best effort, not a guarantee) with strict tools and name the required tool in the prompt:
model.bind_tools(tools, tool_choice="auto", strict=True)  # langchain-anthropic >= 1.1.0

# Other providers and other Claude models:
model.bind_tools(tools, tool_choice="any")              # At least one tool
model.bind_tools(tools, tool_choice="search_database")  # Specific tool
```

**Key rules:**
- Always `bind_tools()` before invoking the model
- Use descriptive `@tool` docstrings — LLM uses them to decide which tool to call
- Keep 5-10 tools max per agent (use dynamic selection for more)
- Use `tool_choice` when a specific tool is required, except on Opus 5.5 or Fable 5.1 (400): there use `auto` plus `strict` tools and a prompt that names the tool

Reference: [LangGraph Tool Calling](https://langchain-ai.github.io/langgraph/concepts/agentic_concepts/#tool-calling-agent)
