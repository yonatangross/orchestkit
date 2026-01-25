# Custom Reducers

Define custom state merging logic with Annotated reducers.

## Implementation

```python
from typing import Annotated, TypedDict

def merge_dicts(existing: dict, update: dict) -> dict:
    """Deep merge dictionaries."""
    return {**existing, **update}

def keep_latest(existing: str, update: str) -> str:
    """Always use the latest value."""
    return update

def max_value(existing: float, update: float) -> float:
    """Keep the maximum score."""
    return max(existing, update)

class AnalysisState(TypedDict):
    config: Annotated[dict, merge_dicts]       # Merges updates
    status: Annotated[str, keep_latest]        # Overwrites
    confidence: Annotated[float, max_value]    # Keeps highest
    findings: Annotated[list[dict], operator.add]  # Accumulates

def analyzer_node(state: AnalysisState) -> dict:
    return {
        "config": {"analyzed": True},  # Merged with existing
        "confidence": 0.85,            # Kept if higher
        "findings": [{"issue": "..."}] # Appended
    }
```

## When to Use

- Merging configuration from multiple nodes
- Tracking maximum/minimum scores
- Custom list deduplication logic
- Complex state aggregation patterns

## Anti-patterns

- Side effects in reducer functions
- Raising exceptions in reducers (fails silently)
- Non-deterministic reducers (breaks replay)
- Overly complex reducer logic