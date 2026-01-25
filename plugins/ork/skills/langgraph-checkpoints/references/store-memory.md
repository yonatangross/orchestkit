# Cross-Thread Store Memory

Long-term memory that persists across conversation threads.

## Implementation

```python
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.store.postgres import PostgresStore
from langgraph.store.base import BaseStore

# Checkpointer = thread-scoped (conversation history)
checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)

# Store = cross-thread (user preferences, learned facts)
store = PostgresStore.from_conn_string(DATABASE_URL)

# Compile with both for full memory support
app = workflow.compile(
    checkpointer=checkpointer,
    store=store
)

async def agent_with_memory(state: AgentState, *, store: BaseStore):
    """Access cross-thread memory in nodes."""
    user_id = state["user_id"]

    # Read user preferences (persists across all threads)
    prefs = await store.aget(
        namespace=("users", user_id),
        key="preferences"
    )

    # Update learned facts
    await store.aput(
        namespace=("users", user_id),
        key="last_topic",
        value={"topic": state["current_topic"]}
    )
    return state
```

## When to Use

- User preferences across sessions
- Learned facts about users
- Cross-conversation context
- Personalization features

## Anti-patterns

- Using only checkpointer for user data (lost per thread)
- No namespace isolation (data collisions)
- Storing large blobs in store (use object storage)
- Not cleaning up stale entries