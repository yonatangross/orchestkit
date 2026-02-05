# State Mapping Reference

Transform state between parent and subgraph boundaries.

## Why State Mapping?

- Different teams define different schemas
- Subgraphs are reusable across projects
- Encapsulation hides internal complexity
- Clear contracts at boundaries

## Input Mapping

```python
def call_subgraph(state: ParentState) -> dict:
    """Map parent state to subgraph input."""

    # Extract only what subgraph needs
    subgraph_input = {
        "query": state["user_query"],
        "context": {
            "user_id": state["user"]["id"],
            "preferences": state["user"]["preferences"]
        },
        # Initialize subgraph-specific fields
        "steps": [],
        "result": None
    }

    result = subgraph.invoke(subgraph_input)
    return output_mapping(result)
```

## Output Mapping

```python
def output_mapping(subgraph_result: SubgraphState) -> dict:
    """Map subgraph output back to parent state."""

    return {
        "analysis_result": {
            "steps": subgraph_result["steps"],
            "conclusion": subgraph_result["result"],
            "metadata": {
                "subgraph": "analyzer",
                "version": "1.0"
            }
        },
        # Don't overwrite unrelated parent keys
    }
```

## Bidirectional Mapping Class

```python
from dataclasses import dataclass

@dataclass
class StateMapper:
    """Reusable state transformation."""

    @staticmethod
    def to_subgraph(parent: ParentState) -> SubgraphState:
        return {
            "input": parent["query"],
            "config": parent.get("config", {}),
            "results": []
        }

    @staticmethod
    def to_parent(subgraph: SubgraphState) -> dict:
        return {
            "output": subgraph["results"],
            "status": "complete" if subgraph["results"] else "empty"
        }

# Usage
def call_subgraph(state: ParentState) -> dict:
    result = subgraph.invoke(StateMapper.to_subgraph(state))
    return StateMapper.to_parent(result)
```

## Validation at Boundaries

```python
from pydantic import BaseModel, ValidationError

class SubgraphInput(BaseModel):
    query: str
    max_results: int = 10

class SubgraphOutput(BaseModel):
    results: list[str]
    confidence: float

def validated_subgraph_call(state: ParentState) -> dict:
    """Validate state at boundaries."""
    try:
        # Validate input
        input_data = SubgraphInput(
            query=state["query"],
            max_results=state.get("limit", 10)
        )

        # Invoke
        raw_result = subgraph.invoke(input_data.model_dump())

        # Validate output
        output = SubgraphOutput(**raw_result)

        return {"result": output.model_dump()}

    except ValidationError as e:
        return {"error": str(e), "result": None}
```

## Accumulating State

```python
from operator import add
from typing import Annotated

class ParentState(TypedDict):
    all_findings: Annotated[list, add]  # Accumulates

def call_multiple_subgraphs(state: ParentState) -> dict:
    """Aggregate results from multiple subgraphs."""
    findings = []

    for subgraph in [sg1, sg2, sg3]:
        result = subgraph.invoke({"query": state["query"]})
        findings.extend(result.get("findings", []))

    # Returns to accumulator
    return {"all_findings": findings}
```
