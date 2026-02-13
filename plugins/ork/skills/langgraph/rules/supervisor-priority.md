---
title: Priority-Based Supervisor Routing
impact: HIGH
impactDescription: "Round-robin dispatch misses critical-first execution order when priorities matter"
tags: supervisor, priority, routing, ordering
---

## Priority-Based Supervisor Routing

Route by priority instead of round-robin when execution order matters (e.g., security before implementation).

**Incorrect — round-robin ignores priority:**
```python
ALL_AGENTS = ["tutorial", "security", "tech", "implementation"]

def supervisor(state):
    completed = set(state["agents_completed"])
    available = [a for a in ALL_AGENTS if a not in completed]
    state["next"] = available[0] if available else END  # tutorial runs before security!
    return state
```

**Correct — priority-ordered execution:**
```python
AGENT_PRIORITIES = {
    "security": 1,         # Run first — block on vulnerabilities
    "tech": 2,
    "implementation": 3,
    "tutorial": 4,         # Run last
}

def priority_supervisor(state) -> Command[Literal["security", "tech", "implementation", "tutorial", END]]:
    completed = set(state["agents_completed"])
    available = [a for a in AGENT_PRIORITIES if a not in completed]

    if not available:
        return Command(update={"status": "complete"}, goto=END)

    next_agent = min(available, key=lambda a: AGENT_PRIORITIES[a])
    return Command(
        update={"current_agent": next_agent},
        goto=next_agent
    )
```

**LLM-Based Supervisor (2026 pattern):**
```python
from pydantic import BaseModel, Field

class SupervisorDecision(BaseModel):
    next_agent: Literal["security", "tech", "DONE"]
    reasoning: str = Field(description="Brief routing rationale")

async def llm_supervisor(state):
    decision = await llm.with_structured_output(SupervisorDecision).ainvoke(prompt)
    if decision.next_agent == "DONE":
        return Command(goto=END)
    return Command(update={"routing_reasoning": decision.reasoning}, goto=decision.next_agent)
```

**Key rules:**
- Use priority dict when execution order matters
- Use LLM-based routing when priorities are dynamic/context-dependent
- Track `agents_completed` list to prevent infinite loops
- 3-8 specialists max per supervisor (avoid coordination overhead)

Reference: [LangGraph Supervisor](https://langchain-ai.github.io/langgraph/concepts/multi_agent/#supervisor)
