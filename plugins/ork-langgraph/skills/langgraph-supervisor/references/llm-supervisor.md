# LLM-Based Supervisor

Use LLM with structured output for intelligent routing decisions.

## Implementation

```python
from pydantic import BaseModel, Field
from typing import Literal

class SupervisorDecision(BaseModel):
    """Validated supervisor routing decision."""
    next_agent: Literal["security", "tech", "tutorial", "DONE"]
    reasoning: str = Field(description="Brief explanation")
    confidence: float = Field(ge=0.0, le=1.0)

async def llm_supervisor(state: WorkflowState) -> dict:
    """Use LLM with structured output for routing."""
    available = [a for a in AGENTS if a not in state["agents_completed"]]

    decision = await llm.with_structured_output(SupervisorDecision).ainvoke(
        f"""Task: {state['input']}
Completed agents: {state['agents_completed']}
Available agents: {available}

Select the next agent or 'DONE' if complete."""
    )

    if decision.next_agent == "DONE":
        return {"next": END, "reasoning": decision.reasoning}

    return {
        "next": decision.next_agent,
        "reasoning": decision.reasoning,
        "routing_confidence": decision.confidence
    }

# Fallback for low confidence
def route_with_fallback(state: WorkflowState) -> str:
    if state.get("routing_confidence", 1.0) < 0.5:
        return "human_review"
    return state["next"]
```

## When to Use

- Complex routing logic
- Dynamic agent selection based on content
- Explainable routing decisions
- Adaptive workflows

## Anti-patterns

- No structured output (unreliable parsing)
- Missing fallback for LLM failures
- No confidence thresholds
- Heavy prompts for simple routing