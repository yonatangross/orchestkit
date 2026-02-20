---
title: Configure persistent checkpointer to survive crashes in production workflows
impact: HIGH
impactDescription: "No checkpointer in production means losing all progress on crash — unrecoverable workflows"
tags: checkpoints, persistence, memorysaver, postgressaver, setup
---

## Checkpointer Setup

Use `MemorySaver` for development, `PostgresSaver` for production.

**Incorrect — no checkpointer:**
```python
app = workflow.compile()  # No checkpointer — progress lost on crash
result = app.invoke(state)  # Can't resume if interrupted
```

**Correct — environment-appropriate checkpointer:**
```python
from langgraph.checkpoint import MemorySaver
from langgraph.checkpoint.postgres import PostgresSaver

# Development: In-memory (fast, no setup)
memory = MemorySaver()
app = workflow.compile(checkpointer=memory)

# Production: PostgreSQL (shared, durable)
checkpointer = PostgresSaver.from_conn_string("postgresql://...")
app = workflow.compile(checkpointer=checkpointer)

# Invoke with thread_id for resumability
config = {"configurable": {"thread_id": "analysis-123"}}
result = app.invoke(initial_state, config=config)
```

**Key rules:**
- Always use a checkpointer in production
- Use deterministic `thread_id` (not random UUID) so you can resume
- Checkpointer saves state after each node execution
- Add `interrupt_before` for manual review points

Reference: [LangGraph Persistence](https://langchain-ai.github.io/langgraph/concepts/persistence/)
