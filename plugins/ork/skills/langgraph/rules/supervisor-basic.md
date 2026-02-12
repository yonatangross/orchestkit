---
title: Supervisor-Worker Pattern
impact: HIGH
impactDescription: "Missing worker→supervisor edges cause workers to exit instead of reporting back"
tags: supervisor, worker, command, coordination, orchestration
---

## Supervisor-Worker Pattern

Central supervisor routes to specialized workers. Use Command API for combined state update + routing.

**Incorrect — missing edges and deprecated API:**
```python
workflow.set_entry_point("supervisor")  # Deprecated!

def supervisor(state):
    state["next"] = "analyzer"  # Mutating state directly
    return state

# No worker → supervisor edges — workers exit after running
```

**Correct — Command API (2026 pattern):**
```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command
from typing import Literal

def supervisor(state) -> Command[Literal["analyzer", "validator", END]]:
    if "analyzer" not in state["agents_completed"]:
        return Command(
            update={"current_agent": "analyzer"},
            goto="analyzer"
        )
    elif "validator" not in state["agents_completed"]:
        return Command(
            update={"current_agent": "validator"},
            goto="validator"
        )
    return Command(update={"status": "complete"}, goto=END)

def analyzer(state):
    result = analyze(state["input"])
    return {"results": [result], "agents_completed": ["analyzer"]}

graph = StateGraph(WorkflowState)
graph.add_node("supervisor", supervisor)
graph.add_node("analyzer", analyzer)
graph.add_node("validator", validator)

graph.add_edge(START, "supervisor")        # Entry point
graph.add_edge("analyzer", "supervisor")   # Workers return to supervisor
graph.add_edge("validator", "supervisor")
# No conditional edges needed — Command handles routing

app = graph.compile()
```

**Key rules:**
- Use `add_edge(START, "supervisor")` not `set_entry_point()` (deprecated)
- Use `Command` when updating state AND routing together
- Every worker must have an edge back to supervisor
- Always include END condition to prevent infinite loops
- Keep supervisor logic lightweight (routing only, no heavy computation)

Reference: [LangGraph Supervisor](https://langchain-ai.github.io/langgraph/concepts/multi_agent/#supervisor)
