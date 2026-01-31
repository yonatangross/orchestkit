# PostgreSQL Checkpointer

Production-ready checkpointing with PostgreSQL for durable workflows.

## Implementation

```python
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import StateGraph

def create_checkpointer(database_url: str) -> PostgresSaver:
    """Create production PostgreSQL checkpointer."""
    return PostgresSaver.from_conn_string(
        database_url,
        save_every=1  # Save after each node
    )

# Compile workflow with checkpointing
checkpointer = create_checkpointer("postgresql://user:pass@host/db")
app = workflow.compile(checkpointer=checkpointer)

# Execute with thread ID for resume capability
config = {"configurable": {"thread_id": "workflow-abc-123"}}
result = app.invoke(initial_state, config=config)

# Resume interrupted workflow
result = app.invoke(None, config=config)  # Continues from last checkpoint
```

## When to Use

- Production deployments requiring durability
- Multi-instance deployments needing shared state
- Long-running workflows with expensive operations
- Workflows requiring crash recovery

## Anti-patterns

- Using MemorySaver in production (lost on restart)
- Random thread IDs (cannot resume)
- save_every=1 for cheap operations (overhead)
- Not handling connection failures