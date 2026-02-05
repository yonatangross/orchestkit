# Invoke Pattern Reference

Call subgraph from within a parent node for isolated state schemas.

## When to Use

- Subgraph needs completely different state keys
- Private message histories per agent
- Multi-level nesting (parent → child → grandchild)
- Teams developing subgraphs independently

## Implementation

```python
from langgraph.graph import StateGraph, START, END

# Parent state
class ParentState(TypedDict):
    user_query: str
    analysis: dict | None
    final_result: str

# Subgraph state (completely different)
class AnalysisState(TypedDict):
    text: str
    findings: list[str]
    confidence: float

# Build subgraph
analysis_builder = StateGraph(AnalysisState)
analysis_builder.add_node("extract", extract_findings)
analysis_builder.add_node("score", calculate_confidence)
analysis_builder.add_edge(START, "extract")
analysis_builder.add_edge("extract", "score")
analysis_builder.add_edge("score", END)
analysis_subgraph = analysis_builder.compile()

# Parent node that invokes subgraph
def run_analysis(state: ParentState) -> dict:
    """Invoke subgraph with state transformation."""
    # Transform parent state → subgraph input
    subgraph_input = {
        "text": state["user_query"],
        "findings": [],
        "confidence": 0.0
    }

    # Invoke
    result = analysis_subgraph.invoke(subgraph_input)

    # Transform subgraph output → parent state
    return {
        "analysis": {
            "findings": result["findings"],
            "confidence": result["confidence"]
        }
    }

# Add to parent
parent_builder = StateGraph(ParentState)
parent_builder.add_node("analyze", run_analysis)
parent_builder.add_edge(START, "analyze")
```

## Config Propagation

```python
from langchain_core.runnables import RunnableConfig

def run_analysis(state: ParentState, config: RunnableConfig) -> dict:
    """Propagate config for tracing and checkpointing."""
    subgraph_input = transform_to_subgraph(state)

    # Pass config to maintain trace hierarchy
    result = analysis_subgraph.invoke(subgraph_input, config)

    return transform_to_parent(result)
```

## Multi-Level Nesting

```python
# Level 3: Grandchild
grandchild = grandchild_builder.compile()

# Level 2: Child (contains grandchild)
def call_grandchild(state: ChildState, config: RunnableConfig):
    return grandchild.invoke({"data": state["input"]}, config)

child_builder.add_node("processor", call_grandchild)
child = child_builder.compile()

# Level 1: Parent (contains child)
def call_child(state: ParentState, config: RunnableConfig):
    return child.invoke({"input": state["query"]}, config)

parent_builder.add_node("child_workflow", call_child)
parent = parent_builder.compile()
```

## Error Handling

```python
def safe_subgraph_call(state: ParentState) -> dict:
    """Handle subgraph errors gracefully."""
    try:
        result = subgraph.invoke(transform(state))
        return {"analysis": result, "error": None}
    except Exception as e:
        return {
            "analysis": None,
            "error": str(e)
        }
```
