# Interrupt and Resume Pattern

Pause workflow execution for human intervention.

## Implementation

```python
from langgraph.graph import StateGraph

workflow = StateGraph(WorkflowState)
workflow.add_node("generate", generate_content)
workflow.add_node("review", human_review_node)
workflow.add_node("publish", publish_content)

# Compile with interrupt point
app = workflow.compile(interrupt_before=["review"])

# Step 1: Run until interrupt
config = {"configurable": {"thread_id": "doc-123"}}
result = app.invoke({"topic": "AI Safety"}, config=config)
# Workflow pauses at 'review' node

# Step 2: Get current state for human review
state = app.get_state(config)
print(f"Content to review: {state.values['draft']}")

# Step 3: Human updates state
state.values["approved"] = True
state.values["feedback"] = "Looks good, minor typo on line 3"
app.update_state(config, state.values)

# Step 4: Resume workflow
final_result = app.invoke(None, config=config)
```

## When to Use

- Content approval before publishing
- High-stakes decisions requiring oversight
- Quality gates in production pipelines
- Compliance review requirements

## Anti-patterns

- No checkpointer configured (cannot resume)
- Forgetting to call update_state before resume
- No timeout for abandoned reviews
- Missing notification to reviewers