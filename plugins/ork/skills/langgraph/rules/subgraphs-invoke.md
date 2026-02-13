---
title: Invoke Subgraph from Node
impact: MEDIUM
impactDescription: "Directly passing parent state to subgraph with different schema causes KeyError at runtime"
tags: subgraphs, invoke, different-schema, isolation, transform
---

## Invoke Subgraph from Node

Use when subgraph needs completely isolated state (different schema from parent).

**Incorrect — no state transformation:**
```python
def call_analysis(state: ParentState):
    result = analysis_subgraph.invoke(state)  # Schema mismatch! KeyError
    return result  # Wrong schema returned to parent
```

**Correct — explicit state mapping at boundaries:**
```python
class ParentState(TypedDict):
    query: str
    analysis_result: dict

class AnalysisState(TypedDict):
    input_text: str
    findings: list[str]
    score: float

# Build and compile subgraph
analysis_builder = StateGraph(AnalysisState)
analysis_builder.add_node("analyze", analyze_node)
analysis_builder.add_node("score", score_node)
analysis_builder.add_edge(START, "analyze")
analysis_builder.add_edge("analyze", "score")
analysis_builder.add_edge("score", END)
analysis_subgraph = analysis_builder.compile()

def call_analysis(state: ParentState) -> dict:
    # Map parent → subgraph state
    subgraph_input = {"input_text": state["query"], "findings": [], "score": 0.0}

    # Invoke subgraph
    subgraph_output = analysis_subgraph.invoke(subgraph_input)

    # Map subgraph → parent state
    return {
        "analysis_result": {
            "findings": subgraph_output["findings"],
            "score": subgraph_output["score"],
        }
    }

parent_builder.add_node("analysis", call_analysis)
```

**Key rules:**
- Transform state at both boundaries (parent→subgraph AND subgraph→parent)
- Compile subgraph separately before adding to parent
- Use for different schemas, private message histories, multi-level nesting

Reference: [LangGraph Subgraphs](https://langchain-ai.github.io/langgraph/concepts/low_level/#subgraphs)
