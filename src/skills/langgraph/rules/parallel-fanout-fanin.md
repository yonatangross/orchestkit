---
title: Use Send API for dynamic fan-out and fan-in parallel branches
impact: HIGH
impactDescription: "Without Send API, parallel branches run sequentially — losing concurrency benefits"
tags: parallel, fanout, fanin, send, concurrent
---

## Fan-Out/Fan-In Pattern

Use `Send` API to dispatch dynamic parallel branches. Results accumulate via `Annotated[list, add]`.

**Incorrect — sequential execution disguised as parallel:**
```python
def process_all(state):
    results = []
    for task in state["tasks"]:
        result = process(task)  # Sequential!
        results.append(result)
    return {"results": results}
```

**Correct — true parallel with Send API:**
```python
from langgraph.graph import StateGraph, START, END
from langgraph.constants import Send
from typing import TypedDict, Annotated
from operator import add

class OverallState(TypedDict):
    subjects: list[str]
    jokes: Annotated[list[str], add]  # Accumulates from parallel branches

class JokeState(TypedDict):
    subject: str

def continue_to_jokes(state: OverallState) -> list[Send]:
    """Fan-out: create parallel branch for each subject."""
    return [Send("generate_joke", {"subject": s}) for s in state["subjects"]]

def generate_joke(state: JokeState) -> dict:
    """Worker: each runs in parallel, writes to accumulator."""
    joke = llm.invoke(f"Tell a joke about {state['subject']}")
    return {"jokes": [f"{state['subject']}: {joke.content}"]}

builder = StateGraph(OverallState)
builder.add_node("generate_topics", generate_topics)
builder.add_node("generate_joke", generate_joke)
builder.add_edge(START, "generate_topics")
builder.add_conditional_edges("generate_topics", continue_to_jokes)
builder.add_edge("generate_joke", END)  # All branches converge automatically
```

**Key rules:**
- `Send` API creates true parallel branches (not async, graph-level parallelism)
- Worker state can differ from overall state (separate TypedDict)
- Use `Annotated[list, add]` on the accumulating field in overall state
- All branches converge automatically when connected to a common next node or END

Reference: [LangGraph Send API](https://langchain-ai.github.io/langgraph/concepts/low_level/#send)
