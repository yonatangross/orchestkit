---
name: langgraph-supervisor
description: LangGraph supervisor-worker pattern. Use when building central coordinator agents that route to specialized workers, implementing round-robin or priority-based agent dispatch.
tags: [langgraph, supervisor, multi-agent, orchestration]
context: fork
agent: workflow-architect
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# LangGraph Supervisor Pattern

Coordinate multiple specialized agents with a central supervisor.

## Overview

- Building central coordinator agents that dispatch to workers
- Implementing round-robin or priority-based task routing
- Tracking agent completion and workflow progress
- Using Command API for combined state update + routing

## Quick Start

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command
from typing import Literal, TypedDict

class WorkflowState(TypedDict):
    input: str
    results: list[str]
    agents_completed: list[str]

def supervisor(state) -> Command[Literal["worker_a", "worker_b", END]]:
    if "worker_a" not in state["agents_completed"]:
        return Command(goto="worker_a")
    elif "worker_b" not in state["agents_completed"]:
        return Command(goto="worker_b")
    return Command(goto=END)

def worker_a(state):
    return {"results": ["A done"], "agents_completed": ["worker_a"]}

def worker_b(state):
    return {"results": ["B done"], "agents_completed": ["worker_b"]}

# Build graph
graph = StateGraph(WorkflowState)
graph.add_node("supervisor", supervisor)
graph.add_node("worker_a", worker_a)
graph.add_node("worker_b", worker_b)
graph.add_edge(START, "supervisor")
graph.add_edge("worker_a", "supervisor")
graph.add_edge("worker_b", "supervisor")

app = graph.compile()
result = app.invoke({"input": "task", "results": [], "agents_completed": []})
```

## Basic Supervisor

```python
from langgraph.graph import StateGraph, START, END

def supervisor(state: WorkflowState) -> WorkflowState:
    """Route to next worker based on state."""
    if state["needs_analysis"]:
        state["next"] = "analyzer"
    elif state["needs_validation"]:
        state["next"] = "validator"
    else:
        state["next"] = END
    return state

def analyzer(state: WorkflowState) -> WorkflowState:
    """Specialized analysis worker."""
    result = analyze(state["input"])
    state["results"].append(result)
    return state

# Build graph
workflow = StateGraph(WorkflowState)
workflow.add_node("supervisor", supervisor)
workflow.add_node("analyzer", analyzer)
workflow.add_node("validator", validator)

# Supervisor routes dynamically
workflow.add_conditional_edges(
    "supervisor",
    lambda s: s["next"],
    {
        "analyzer": "analyzer",
        "validator": "validator",
        END: END
    }
)

# Workers return to supervisor
workflow.add_edge("analyzer", "supervisor")
workflow.add_edge("validator", "supervisor")

workflow.add_edge(START, "supervisor")  # Use START, not set_entry_point()
app = workflow.compile()
```

## Command API (2026 Best Practice)

Use Command when you need to update state AND route in the same node:

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command
from typing import Literal

def supervisor_with_command(state: WorkflowState) -> Command[Literal["analyzer", "validator", END]]:
    """Use Command for combined state update + routing."""
    if state["needs_analysis"]:
        return Command(
            update={"current_agent": "analyzer", "routing_reason": "needs analysis"},
            goto="analyzer"
        )
    elif state["needs_validation"]:
        return Command(
            update={"current_agent": "validator", "routing_reason": "needs validation"},
            goto="validator"
        )
    return Command(
        update={"status": "complete"},
        goto=END
    )

# Build graph with Command
workflow = StateGraph(WorkflowState)
workflow.add_node("supervisor", supervisor_with_command)
workflow.add_node("analyzer", analyzer)
workflow.add_node("validator", validator)

# No conditional edges needed - Command handles routing
workflow.add_edge(START, "supervisor")
workflow.add_edge("analyzer", "supervisor")
workflow.add_edge("validator", "supervisor")

app = workflow.compile()
```

**When to use Command vs Conditional Edges:**
- **Command**: When updating state AND routing together
- **Conditional edges**: When routing only (no state updates needed)

## Round-Robin Supervisor

```python
ALL_AGENTS = ["security", "tech", "implementation", "tutorial"]

def supervisor_node(state: AnalysisState) -> AnalysisState:
    """Route to next available agent."""
    completed = set(state["agents_completed"])
    available = [a for a in ALL_AGENTS if a not in completed]

    if not available:
        state["next"] = "quality_gate"
    else:
        state["next"] = available[0]

    return state

# Register all agent nodes
for agent_name in ALL_AGENTS:
    workflow.add_node(agent_name, create_agent_node(agent_name))
    workflow.add_edge(agent_name, "supervisor")
```

## Priority-Based Routing

```python
AGENT_PRIORITIES = {
    "security": 1,    # Run first
    "tech": 2,
    "implementation": 3,
    "tutorial": 4     # Run last
}

def priority_supervisor(state: WorkflowState) -> WorkflowState:
    """Route by priority, not round-robin."""
    completed = set(state["agents_completed"])
    available = [a for a in AGENT_PRIORITIES if a not in completed]

    if not available:
        state["next"] = "finalize"
    else:
        # Sort by priority
        next_agent = min(available, key=lambda a: AGENT_PRIORITIES[a])
        state["next"] = next_agent

    return state
```

## LLM-Based Supervisor (2026 Best Practice)

```python
from pydantic import BaseModel, Field
from typing import Literal

# Define structured output schema
class SupervisorDecision(BaseModel):
    """Validated supervisor routing decision."""
    next_agent: Literal["security", "tech", "implementation", "tutorial", "DONE"]
    reasoning: str = Field(description="Brief explanation for routing decision")

async def llm_supervisor(state: WorkflowState) -> WorkflowState:
    """Use LLM with structured output for reliable routing."""
    available = [a for a in AGENTS if a not in state["agents_completed"]]

    # Use structured output (2026 best practice)
    decision = await llm.with_structured_output(SupervisorDecision).ainvoke(
        f"""Task: {state['input']}

Completed: {state['agents_completed']}
Available: {available}

Select the next agent or 'DONE' if all work is complete."""
    )

    # Validated response - no string parsing needed
    state["next"] = END if decision.next_agent == "DONE" else decision.next_agent
    state["routing_reasoning"] = decision.reasoning  # Track decision rationale
    return state

# Alternative: OpenAI structured output
async def llm_supervisor_openai(state: WorkflowState) -> WorkflowState:
    """OpenAI with strict structured output."""
    response = await client.beta.chat.completions.parse(
        model="gpt-5.2",
        messages=[{"role": "user", "content": prompt}],
        response_format=SupervisorDecision
    )
    decision = response.choices[0].message.parsed
    state["next"] = END if decision.next_agent == "DONE" else decision.next_agent
    return state
```

## Tracking Progress

```python
def agent_node_factory(agent_name: str):
    """Create agent node that tracks completion."""
    async def node(state: WorkflowState) -> WorkflowState:
        result = await agents[agent_name].run(state["input"])

        return {
            **state,
            "results": state["results"] + [result],
            "agents_completed": state["agents_completed"] + [agent_name],
            "current_agent": None
        }
    return node
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Routing strategy | Round-robin for uniform, priority for critical-first |
| Max agents | 3-8 specialists (avoid overhead) |
| Failure handling | Skip failed agent, continue with others |
| Coordination | Centralized supervisor (simpler debugging) |
| Command vs Conditional | Use Command when updating state + routing together |
| Entry point | Use `add_edge(START, node)` not `set_entry_point()` |

## Common Mistakes

- No completion tracking (runs agents forever)
- Forgetting worker → supervisor edge
- Missing END condition
- Heavy supervisor logic (should be lightweight)
- Using `set_entry_point()` (deprecated, use `add_edge(START, ...)`)
- Using conditional edges when Command would be cleaner

## Evaluations

See [references/evaluations.md](references/evaluations.md) for test cases.

## Related Skills

- `langgraph-routing` - Conditional edge patterns for dynamic routing
- `langgraph-parallel` - Fan-out/fan-in for parallel worker execution
- `langgraph-state` - State schemas with completion tracking
- `langgraph-checkpoints` - Persist supervisor progress for fault tolerance
- `langgraph-streaming` - Real-time progress updates during workflow
- `langgraph-human-in-loop` - Add human approval gates to supervisor decisions

## Capability Details

### supervisor-design
**Keywords:** supervisor, orchestration, routing, delegation
**Solves:**
- Design supervisor agent patterns
- Route tasks to specialized workers
- Coordinate multi-agent workflows

### worker-delegation
**Keywords:** worker, delegation, specialized, agent
**Solves:**
- Create specialized worker agents
- Define worker capabilities
- Implement delegation logic

### orchestkit-workflow
**Keywords:** orchestkit, analysis, content, workflow
**Solves:**
- OrchestKit analysis workflow example
- Production supervisor implementation
- Real-world orchestration pattern

### supervisor-template
**Keywords:** template, implementation, code, starter
**Solves:**
- Supervisor workflow template
- Production-ready code
- Copy-paste implementation

### content-analysis
**Keywords:** content, analysis, graph, multi-agent
**Solves:**
- Content analysis graph template
- OrchestKit-specific workflow
- Multi-agent content processing
