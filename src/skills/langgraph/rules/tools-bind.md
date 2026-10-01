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
model = ChatAnthropic(model="claude-sonnet-5-5")
model_with_tools = model.bind_tools(tools)

def agent_node(state):
    response = model_with_tools.invoke(state["messages"])
    return {"messages": [response]}
```

**Require a tool call on Claude Sonnet 5.5, Opus 5.5, Fable 5.1 or Mythos 5.1:**
```python
# These models return a 400 on forced tool_choice ("any" or a named tool).
# Use auto with strict tools, and name the tool in the prompt:
model_with_tools = model.bind_tools(tools, tool_choice="auto", strict=True)  # langchain-anthropic >= 1.1.0

def agent_node(state):
    prompt = [("system", "Look the answer up with search_database before you reply.")]
    response = model_with_tools.invoke(prompt + state["messages"])
    if not response.tool_calls:
        ...  # auto is best effort: retry once or route to a fallback, never assume the call happened
    return {"messages": [response]}
```

**Require a tool call on other providers and pre-5.5 Claude models (for example Sonnet 5, Haiku 4.5):**
```python
model.bind_tools(tools, tool_choice="any")              # At least one tool
model.bind_tools(tools, tool_choice="search_database")  # Specific tool
```

**Key rules:**
- Always `bind_tools()` before invoking the model
- Use descriptive `@tool` docstrings — LLM uses them to decide which tool to call
- Keep 5-10 tools max per agent (use dynamic selection for more)
- On Sonnet 5.5, Opus 5.5, Fable 5.1 and Mythos 5.1, forced `tool_choice` returns a 400: use `tool_choice="auto"` with `strict` tools and a prompt line that names the tool, then check `response.tool_calls`, since `auto` lets the model answer in text instead
- On other providers and pre-5.5 Claude models, `tool_choice="any"` or a named tool still forces the call

Reference: [LangGraph Tool Calling](https://langchain-ai.github.io/langgraph/concepts/agentic_concepts/#tool-calling-agent)
