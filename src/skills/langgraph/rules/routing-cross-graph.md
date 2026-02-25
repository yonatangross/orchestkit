---
title: Use Command(graph=...) for cross-graph navigation between parent and sibling subgraphs
impact: HIGH
impactDescription: "Without graph parameter, Command only routes within current subgraph — cross-graph escalation and delegation fail silently"
tags: routing, cross-graph, command, parent, sibling, subgraphs, handoff
---

## Cross-Graph Navigation

Use `Command(graph=Command.PARENT)` to navigate from a subgraph node to the parent graph. Use `Command(graph="sibling_name")` for cross-graph routing between sibling subgraphs. Available in LangGraph v0.2.58+.

**Incorrect — routing stays within subgraph:**
```python
def child_node(state: ChildState) -> Command[Literal["escalate"]]:
    if state["needs_escalation"]:
        return Command(goto="escalate")  # Looks for "escalate" in child graph — fails!
```

**Correct — Command.PARENT for child-to-parent:**
```python
from langgraph.types import Command
from typing_extensions import Literal

def child_node(state: ChildState) -> Command[Literal["supervisor"]]:
    if state["needs_escalation"]:
        return Command(
            update={"escalation_reason": "Complexity exceeded threshold"},
            goto="supervisor",
            graph=Command.PARENT,  # Navigate to parent graph
        )
    return Command(update={"result": "handled"}, goto="next_step")
```

**Parent graph setup with child subgraph:**
```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Annotated
from operator import add

class ParentState(TypedDict):
    query: str
    escalation_reason: str
    results: Annotated[list[str], add]  # Reducer required for shared keys

class ChildState(TypedDict):
    query: str
    escalation_reason: str

# Child subgraph
child_builder = StateGraph(ChildState)
child_builder.add_node("analyze", child_node)
child_builder.add_edge(START, "analyze")
child_graph = child_builder.compile()

# Parent graph
parent_builder = StateGraph(ParentState)
parent_builder.add_node("child_agent", child_graph)
parent_builder.add_node("supervisor", supervisor_node)
parent_builder.add_node("specialist", specialist_node)
parent_builder.add_edge(START, "child_agent")
parent_builder.add_edge("supervisor", "specialist")
parent_builder.add_edge("specialist", END)

app = parent_builder.compile()
```

**Cross-graph routing to sibling subgraph:**
```python
def agent_a_node(state: AgentAState) -> Command[Literal["agent_b"]]:
    if state["needs_different_expertise"]:
        return Command(
            update={"handoff_context": state["partial_result"]},
            goto="agent_b",          # Sibling node in parent graph
            graph=Command.PARENT,    # Navigate up to parent first
        )
    return Command(update={"result": "done"}, goto=END)
```

**State mapping between different schemas:**
```python
class ParentState(TypedDict):
    query: str
    context: Annotated[list[str], add]  # Must have reducer for updates from children

class ResearcherState(TypedDict):
    query: str
    context: str  # Different type than parent — mapping happens at boundary

def researcher_node(state: ResearcherState) -> Command[Literal["writer"]]:
    finding = research(state["query"])
    return Command(
        update={"context": [finding]},  # Match parent's list type with reducer
        goto="writer",
        graph=Command.PARENT,
    )
```

**Key rules:**
- `Command.PARENT` navigates to the closest parent graph
- For sibling routing: go to parent first, then target the sibling node name
- Shared state keys updated via `Command.PARENT` **must** have reducers in parent state
- State types can differ between parent and child — map values at the boundary
- Use cases: escalation, delegation, multi-agent handoff, error propagation
- Requires LangGraph v0.2.58+ (stable in v0.3+)
- Do not wrap `Command` returns in try/except — it uses exceptions internally

Reference: [Cross-graph navigation](https://langchain-ai.github.io/langgraph/how-tos/command/#navigate-to-a-node-in-a-parent-graph)
