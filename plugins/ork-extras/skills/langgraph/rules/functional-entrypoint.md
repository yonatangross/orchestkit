---
title: "Configure @entrypoint decorator with checkpointer for resumable workflows"
impact: MEDIUM
impactDescription: "Missing checkpointer on @entrypoint means interrupted workflows cannot resume"
tags: functional, entrypoint, decorator, workflow, checkpoint
---

## @entrypoint Decorator

Define workflow entry points with optional checkpointing. Simpler than explicit StateGraph construction.

**Incorrect — no checkpointer for resumable workflow:**
```python
@entrypoint()
def my_workflow(data: str) -> str:
    result = expensive_task(data).result()
    return result
    # If interrupted, all progress lost — no checkpointer
```

**Correct — with checkpointer:**
```python
from langgraph.func import entrypoint, task
from langgraph.checkpoint.memory import InMemorySaver

checkpointer = InMemorySaver()

@entrypoint(checkpointer=checkpointer)
def my_workflow(data: str) -> str:
    result = expensive_task(data).result()
    return result

# Invoke with thread_id for resumability
config = {"configurable": {"thread_id": "session-123"}}
result = my_workflow.invoke("input", config)
```

**Human-in-the-loop with @entrypoint:**
```python
from langgraph.types import interrupt, Command

@entrypoint(checkpointer=checkpointer)
def approval_workflow(request: dict) -> dict:
    result = analyze_request(request).result()

    approved = interrupt({"question": "Approve?", "details": result})

    if approved:
        return execute_action(result).result()
    return {"status": "rejected"}

# Resume after human review
for chunk in approval_workflow.stream(Command(resume=True), config):
    print(chunk)
```

**Graph API vs Functional API:**
- **Functional**: Sequential workflows, orchestrator-worker, simpler debugging
- **Graph**: Complex topology, dynamic routing, subgraph composition

**Key rules:**
- Add `checkpointer` when workflow needs persistence/resume
- Functional API builds graph implicitly from task call order
- `@entrypoint` is the workflow entry — orchestrates `@task` functions
- Regular functions (no decorator) execute normally, not tracked

Reference: [LangGraph Functional API](https://langchain-ai.github.io/langgraph/concepts/functional_api/)
