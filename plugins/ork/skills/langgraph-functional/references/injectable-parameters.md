# Injectable Parameters Reference

Access runtime context in entrypoints via injectable parameters.

## Available Parameters

```python
from langgraph.func import entrypoint
from langgraph.store.base import BaseStore
from langchain_core.runnables import RunnableConfig
from typing import Any

@entrypoint(checkpointer=checkpointer, store=store)
def workflow(
    input: dict,                    # Required: user input
    *,
    previous: Any = None,           # Last return value for this thread
    store: BaseStore,               # Cross-thread memory (long-term)
    config: RunnableConfig          # Runtime configuration
) -> dict:
    # Use injected parameters
    ...
```

## previous Parameter

Access the last return value for this thread_id:

```python
@entrypoint(checkpointer=checkpointer)
def counter_workflow(increment: int, *, previous: int = None) -> int:
    """Accumulate values across invocations."""
    previous = previous or 0
    return previous + increment

# First call
result = counter_workflow.invoke(5, config={"configurable": {"thread_id": "counter-1"}})
# Returns: 5

# Second call (same thread)
result = counter_workflow.invoke(3, config={"configurable": {"thread_id": "counter-1"}})
# Returns: 8 (previous=5, increment=3)
```

## store Parameter

Access cross-thread memory for long-term persistence:

```python
@entrypoint(checkpointer=checkpointer, store=store)
async def workflow(input: dict, *, store: BaseStore) -> dict:
    user_id = input["user_id"]

    # Read user preferences (persists across all threads)
    prefs = await store.aget(
        namespace=("users", user_id),
        key="preferences"
    )

    # Update learned facts
    await store.aput(
        namespace=("users", user_id),
        key="last_topic",
        value={"topic": input["topic"], "timestamp": datetime.now().isoformat()}
    )

    return {"preferences": prefs.value if prefs else {}}
```

## config Parameter

Access runtime configuration:

```python
@entrypoint(checkpointer=checkpointer)
def workflow(input: dict, *, config: RunnableConfig) -> dict:
    # Get thread ID
    thread_id = config["configurable"]["thread_id"]

    # Get custom config values
    model_name = config.get("model", "claude-sonnet")
    temperature = config.get("temperature", 0.7)

    # Get run metadata
    run_id = config.get("run_id")

    return {"thread": thread_id, "model": model_name}

# Invoke with custom config
result = workflow.invoke(
    {"query": "hello"},
    config={
        "configurable": {"thread_id": "t1"},
        "model": "claude-opus",
        "temperature": 0.5
    }
)
```

## Combining Parameters

```python
@entrypoint(checkpointer=checkpointer, store=store)
async def smart_assistant(
    query: str,
    *,
    previous: dict = None,
    store: BaseStore,
    config: RunnableConfig
) -> dict:
    user_id = config["configurable"].get("user_id", "anonymous")

    # Load user context from store
    user_data = await store.aget(("users", user_id), "profile")

    # Use previous conversation context
    context = previous.get("context", []) if previous else []

    # Process query with full context
    response = await process_with_context(query, user_data, context)

    # Save updated context
    return {
        "response": response,
        "context": context + [{"query": query, "response": response}]
    }
```
