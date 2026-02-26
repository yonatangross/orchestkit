---
title: Use Store for cross-thread memory instead of per-thread checkpoints
impact: HIGH
impactDescription: "Using only checkpointer for user preferences loses them across threads — use Store for cross-thread data"
tags: checkpoints, store, memory, cross-thread, long-term
---

## Cross-Thread Store Memory

Checkpointer = short-term (thread-scoped). Store = long-term (cross-thread, namespaced).

**Incorrect — preferences in checkpointer only:**
```python
# User preferences stored in thread-1 state
# When user starts thread-2, preferences are lost!
checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)
app = workflow.compile(checkpointer=checkpointer)
```

**Correct — Store for cross-thread memory:**
```python
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.store.postgres import PostgresStore

# Checkpointer = SHORT-TERM (thread-scoped)
checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)

# Store = LONG-TERM (cross-thread, namespaced)
store = PostgresStore.from_conn_string(DATABASE_URL)

# Compile with BOTH
app = workflow.compile(checkpointer=checkpointer, store=store)
```

**Using Store in nodes:**
```python
from langgraph.store.base import BaseStore

async def agent_with_memory(state: AgentState, *, store: BaseStore):
    user_id = state["user_id"]

    # Read cross-thread memory
    memories = await store.aget(namespace=("users", user_id), key="preferences")
    if memories and memories.value.get("prefers_concise"):
        state["system_prompt"] += "\nBe concise."

    # Write cross-thread memory
    await store.aput(
        namespace=("users", user_id),
        key="last_topic",
        value={"topic": state["current_topic"], "timestamp": datetime.now().isoformat()}
    )
    return state
```

**Memory architecture:**
```
Thread 1 (chat-001)    Thread 2 (chat-002)
┌─────────────────┐    ┌─────────────────┐
│ Checkpointer    │    │ Checkpointer    │
│ - msg history   │    │ - msg history   │
│ - workflow pos  │    │ - workflow pos  │
└─────────────────┘    └─────────────────┘
         ↓ shared ↓
┌─────────────────────────────────────┐
│     Store (cross-thread)            │
│  namespace=("users", "alice")       │
│  - preferences, last_topic          │
└─────────────────────────────────────┘
```

**Key rules:**
- Checkpointer for conversation history and workflow position (thread-scoped)
- Store for user preferences, learned facts, settings (cross-thread)
- Always use namespaces in Store to prevent data collisions
- Clean up old checkpoints but keep Store data persistent

Reference: [LangGraph Memory](https://langchain-ai.github.io/langgraph/concepts/memory/)
