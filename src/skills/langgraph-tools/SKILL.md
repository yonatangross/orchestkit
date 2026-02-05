---
name: langgraph-tools
description: LangGraph tool calling patterns. Use when binding tools to LLMs, implementing ToolNode for execution, dynamic tool selection, or adding approval gates to tool calls.
tags: [langgraph, tools, function-calling, agents]
context: fork
agent: workflow-architect
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# LangGraph Tool Calling

Integrate tool calling into LangGraph workflows.

## Basic Tool Binding

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

# Bind tools to model
tools = [search_database, send_email]
model = ChatAnthropic(model="claude-sonnet-4-20250514")
model_with_tools = model.bind_tools(tools)

# Agent node
def agent_node(state: State):
    response = model_with_tools.invoke(state["messages"])
    return {"messages": [response]}
```

## ToolNode for Execution

```python
from langgraph.prebuilt import ToolNode
from langgraph.graph import StateGraph, START, END

# Create tool execution node
tool_node = ToolNode(tools)

# Build agent graph
builder = StateGraph(MessagesState)
builder.add_node("agent", agent_node)
builder.add_node("tools", tool_node)

# Routing based on tool calls
def should_continue(state: MessagesState) -> str:
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return END

builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
builder.add_edge("tools", "agent")  # Return to agent after tool execution

graph = builder.compile()
```

## Force Tool Calling

```python
# Force model to call at least one tool
model.bind_tools(tools, tool_choice="any")

# Force specific tool
model.bind_tools(tools, tool_choice="search_database")

# Structured output via tool (guaranteed schema)
from pydantic import BaseModel

class SearchResult(BaseModel):
    query: str
    results: list[str]
    confidence: float

model.bind_tools([SearchResult], tool_choice="SearchResult")
```

## Dynamic Tool Selection

```python
from sentence_transformers import SentenceTransformer

embedder = SentenceTransformer("all-MiniLM-L6-v2")

# Pre-compute tool embeddings
TOOL_EMBEDDINGS = {
    tool.name: embedder.encode(tool.description)
    for tool in all_tools
}

def select_relevant_tools(query: str, all_tools: list, top_k: int = 5) -> list:
    """Select most relevant tools based on query."""
    query_embedding = embedder.encode(query)

    similarities = [
        (tool, cosine_similarity(query_embedding, TOOL_EMBEDDINGS[tool.name]))
        for tool in all_tools
    ]

    sorted_tools = sorted(similarities, key=lambda x: x[1], reverse=True)
    return [tool for tool, _ in sorted_tools[:top_k]]

def agent_with_dynamic_tools(state: State):
    """Bind only relevant tools to reduce context."""
    relevant_tools = select_relevant_tools(
        state["messages"][-1].content,
        all_tools,
        top_k=5
    )

    model_bound = model.bind_tools(relevant_tools)
    response = model_bound.invoke(state["messages"])
    return {"messages": [response]}
```

## Tool Interrupts (Approval Gates)

```python
from langgraph.types import interrupt

@tool
def delete_user(user_id: str) -> str:
    """Delete a user account. Requires approval."""
    # Interrupt for human approval
    response = interrupt({
        "action": "delete_user",
        "user_id": user_id,
        "message": f"Approve deletion of user {user_id}?",
        "risk_level": "high"
    })

    if response.get("approved"):
        db.delete_user(user_id)
        return f"User {user_id} deleted successfully"
    return "Deletion cancelled by user"

@tool
def transfer_funds(from_account: str, to_account: str, amount: float) -> str:
    """Transfer funds between accounts. Requires approval for large amounts."""
    if amount > 1000:
        response = interrupt({
            "action": "transfer_funds",
            "from": from_account,
            "to": to_account,
            "amount": amount,
            "message": f"Approve transfer of ${amount}?"
        })

        if not response.get("approved"):
            return "Transfer cancelled"

    execute_transfer(from_account, to_account, amount)
    return f"Transferred ${amount} from {from_account} to {to_account}"
```

## Streaming from Tools

```python
from langgraph.config import get_stream_writer

@tool
def long_running_analysis(data: str) -> str:
    """Analyze data with progress updates."""
    writer = get_stream_writer()

    writer({"status": "starting", "progress": 0})

    for i, chunk in enumerate(process_chunks(data)):
        writer({
            "status": "processing",
            "progress": (i + 1) * 10,
            "current_chunk": i
        })

    writer({"status": "complete", "progress": 100})
    return "Analysis complete"
```

## Error Handling in Tools

```python
@tool
def api_call_with_retry(endpoint: str) -> str:
    """Call external API with automatic retry."""
    for attempt in range(3):
        try:
            response = requests.get(endpoint, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            if attempt == 2:
                return f"Error: Failed after 3 attempts - {str(e)}"
            time.sleep(2 ** attempt)  # Exponential backoff
```

## Parallel Tool Execution

```python
from langgraph.prebuilt import ToolNode

# ToolNode executes multiple tool calls in parallel by default
tool_node = ToolNode(tools)

# If agent returns multiple tool_calls, they execute concurrently
# Results are returned in order matching the tool_calls
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Tool count | 5-10 tools max per agent (use dynamic selection for more) |
| Approval gates | Use `interrupt()` for destructive/high-risk operations |
| Error handling | Return error strings, don't raise (lets agent recover) |
| Streaming | Use `get_stream_writer()` for long-running tools |

## Common Mistakes

- Too many tools (context overflow, poor selection)
- Raising exceptions in tools (crashes agent loop)
- Missing tool descriptions (LLM can't choose correctly)
- Not using `tool_choice` when specific tool is required

## Evaluations

See [references/evaluations.md](references/evaluations.md) for test cases.

## Related Skills

- `langgraph-supervisor` - Supervisor agents with tool-calling workers
- `langgraph-human-in-loop` - Approval gates for dangerous tools
- `langgraph-streaming` - Stream tool execution progress
- `langgraph-routing` - Route based on tool results
- `langgraph-state` - Track tool call history in state
- `function-calling` - General LLM function calling patterns

## Capability Details

### bind-tools
**Keywords:** bind_tools, tool calling, function calling, LLM tools
**Solves:**
- Attach tools to language models
- Enable function calling in agents
- Configure tool selection behavior

### tool-node
**Keywords:** ToolNode, execute tools, tool execution, prebuilt
**Solves:**
- Execute tool calls from LLM responses
- Handle parallel tool execution
- Integrate tools into graph workflows

### dynamic-tools
**Keywords:** dynamic, select tools, many tools, relevance
**Solves:**
- Handle large tool inventories
- Select relevant tools per query
- Reduce context usage

### tool-interrupts
**Keywords:** interrupt, approval, gate, human review, dangerous
**Solves:**
- Add approval gates to dangerous tools
- Implement human oversight
- Control high-risk operations
