# Pydantic State Pattern

Validated state models using Pydantic for API boundaries.

## Implementation

```python
from pydantic import BaseModel, Field, field_validator
from typing import Literal

class WorkflowInput(BaseModel):
    """Validated API input."""
    query: str = Field(min_length=1, max_length=1000)
    mode: Literal["fast", "thorough"] = "fast"
    max_results: int = Field(default=10, ge=1, le=100)

class WorkflowOutput(BaseModel):
    """Validated API output."""
    results: list[dict]
    confidence: float = Field(ge=0.0, le=1.0)
    processing_time_ms: int

    @field_validator("results")
    @classmethod
    def validate_results(cls, v):
        if not v:
            raise ValueError("Results cannot be empty")
        return v

# Internal state stays lightweight
class InternalState(TypedDict):
    input: WorkflowInput
    intermediate: list[dict]
    output: WorkflowOutput | None
```

## When to Use

- API input/output validation
- User-facing data with strict requirements
- Complex validation rules
- Self-documenting schemas

## Anti-patterns

- Using Pydantic for internal graph state (overhead)
- Skipping validation at API boundaries
- Mixing Pydantic and TypedDict randomly
- No default values for optional fields