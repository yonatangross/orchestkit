# Bind Tools Reference

Attach tools to language models for function calling.

## Basic Binding

```python
from langchain_core.tools import tool
from langchain_anthropic import ChatAnthropic

@tool
def get_weather(location: str) -> str:
    """Get current weather for a location."""
    return weather_api.get(location)

@tool
def search_web(query: str) -> str:
    """Search the web for information."""
    return search_api.search(query)

# Create model
model = ChatAnthropic(model="claude-sonnet-4-20250514")

# Bind tools
tools = [get_weather, search_web]
model_with_tools = model.bind_tools(tools)

# Model can now call tools
response = model_with_tools.invoke("What's the weather in Paris?")
# response.tool_calls = [{"name": "get_weather", "args": {"location": "Paris"}}]
```

## Tool Choice Options

```python
# Let model decide (default)
model.bind_tools(tools)

# Force at least one tool call
model.bind_tools(tools, tool_choice="any")

# Force specific tool
model.bind_tools(tools, tool_choice="get_weather")

# Disable tools for this call
model.bind_tools(tools, tool_choice="none")
```

## Structured Output via Tools

```python
from pydantic import BaseModel, Field

class AnalysisResult(BaseModel):
    """Structured analysis output."""
    sentiment: str = Field(description="positive, negative, or neutral")
    confidence: float = Field(ge=0, le=1)
    key_points: list[str]

# Bind as tool with forced selection
model_structured = model.bind_tools(
    [AnalysisResult],
    tool_choice="AnalysisResult"
)

response = model_structured.invoke("Analyze: Great product!")
# Guaranteed to return AnalysisResult schema
result = AnalysisResult(**response.tool_calls[0]["args"])
```

## In Agent Node

```python
def agent_node(state: MessagesState):
    """Agent node with bound tools."""
    response = model_with_tools.invoke(state["messages"])
    return {"messages": [response]}
```

## Dynamic Rebinding

```python
def agent_with_context_tools(state: State):
    """Bind different tools based on context."""
    if state["mode"] == "research":
        tools = [search_web, read_document, summarize]
    elif state["mode"] == "action":
        tools = [send_email, create_task, update_database]
    else:
        tools = [search_web]

    model_bound = model.bind_tools(tools)
    return {"messages": [model_bound.invoke(state["messages"])]}
```

## Parallel Tool Binding

```python
# Model can call multiple tools in one response
response = model_with_tools.invoke(
    "Get weather in Paris and Tokyo"
)

# response.tool_calls might contain:
# [
#   {"name": "get_weather", "args": {"location": "Paris"}},
#   {"name": "get_weather", "args": {"location": "Tokyo"}}
# ]
```
