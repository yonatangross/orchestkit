# MessagesState Pattern

Standard pattern for chat-based agents using LangGraph's built-in MessagesState.

## Implementation

```python
from langgraph.graph import MessagesState
from langgraph.graph.message import add_messages
from typing import Annotated

# Option 1: Extend built-in MessagesState (recommended)
class AgentState(MessagesState):
    """Chat agent with custom fields."""
    user_id: str
    context: dict
    tool_calls: list[dict]

# Option 2: Manual messages with add_messages reducer
class CustomState(TypedDict):
    messages: Annotated[list, add_messages]  # Smart append/update by ID
    session_id: str
    metadata: dict

def chat_node(state: AgentState) -> dict:
    """Process and return new messages."""
    response = llm.invoke(state["messages"])
    return {"messages": [response]}  # Appends, doesn't replace
```

## When to Use

- Chat-based agents and assistants
- Multi-turn conversations with history
- Agents that need message deduplication
- Tool-calling workflows

## Anti-patterns

- Using `MessageGraph` (deprecated in LangGraph v1.0.0)
- Replacing messages list instead of appending
- Not using `add_messages` for message accumulation
- Manual message ID management