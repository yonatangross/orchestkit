---
title: Use MessagesState with add_messages reducer to preserve conversation history
impact: CRITICAL
impactDescription: "Without add_messages reducer, conversation history overwrites on every node update"
tags: state, messages, add_messages, chat, conversation
---

## MessagesState Pattern

Use `MessagesState` or `add_messages` reducer for any workflow handling conversation messages.

**Incorrect:**
```python
class AgentState(TypedDict):
    messages: list  # No reducer — each node REPLACES entire message history
    user_id: str

def agent_node(state):
    response = llm.invoke(state["messages"])
    return {"messages": [response]}  # Overwrites all previous messages!
```

**Correct:**
```python
from langgraph.graph import MessagesState
from langgraph.graph.message import add_messages
from typing import Annotated

# Option 1: Extend built-in MessagesState (recommended)
class AgentState(MessagesState):
    user_id: str
    context: dict

# Option 2: Manual add_messages reducer
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]  # Smart append/update by ID
    user_id: str

def agent_node(state):
    response = llm.invoke(state["messages"])
    return {"messages": [response]}  # Appends, doesn't overwrite
```

**Why `add_messages` matters:**
- Appends new messages (doesn't overwrite)
- Updates existing messages by matching ID
- Handles message deduplication automatically

**Note:** `MessageGraph` is deprecated in LangGraph v1.0.0. Use `StateGraph` with a `messages` key instead.

Reference: [LangGraph MessagesState](https://langchain-ai.github.io/langgraph/concepts/low_level/#messagesstate)
