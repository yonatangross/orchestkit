---
title: Apply Pydantic state validation at boundaries only to minimize runtime overhead
impact: HIGH
impactDescription: "Using Pydantic everywhere adds runtime overhead — use at boundaries only"
tags: state, pydantic, validation, basemodel
---

## Pydantic State Validation

Use TypedDict internally (lightweight), Pydantic BaseModel at system boundaries (user input, API output).

**Incorrect:**
```python
from pydantic import BaseModel

# Using Pydantic for ALL internal state — unnecessary runtime validation overhead
class WorkflowState(BaseModel):
    input: str
    intermediate_result: str = ""
    agent_responses: list[dict] = []
    # Every node update triggers Pydantic validation
```

**Correct:**
```python
from typing import TypedDict, Annotated
from operator import add
from pydantic import BaseModel, Field

# Internal state: TypedDict (no runtime overhead)
class WorkflowState(TypedDict):
    input: str
    output: str
    agent_responses: Annotated[list[dict], add]

# Boundary validation: Pydantic (validates external data)
class WorkflowInput(BaseModel):
    input: str = Field(description="User input", min_length=1)
    config: dict = Field(default_factory=dict)

class WorkflowOutput(BaseModel):
    output: str
    confidence: float = Field(ge=0, le=1)
```

**Key rules:**
- TypedDict for internal graph state (lightweight, no runtime cost)
- Pydantic at boundaries: API inputs, user-facing outputs, LLM structured output
- `Annotated[list, add]` works with TypedDict, not with Pydantic BaseModel

Reference: [LangGraph State Concepts](https://langchain-ai.github.io/langgraph/concepts/low_level/#state)
