# Feedback Loop Pattern

Iterate with human feedback until approval.

## Implementation

```python
import uuid_utils

async def run_with_feedback_loop(
    app,
    initial_state: dict,
    max_iterations: int = 5
) -> dict:
    """Run workflow with iterative human feedback."""
    config = {"configurable": {"thread_id": str(uuid_utils.uuid7())}}

    for iteration in range(max_iterations):
        # Run until interrupt
        result = app.invoke(
            initial_state if iteration == 0 else None,
            config=config
        )

        # Get state for review
        state = app.get_state(config)
        print(f"\n--- Iteration {iteration + 1} ---")
        print(f"Output: {state.values.get('output', 'N/A')}")

        # Collect human feedback
        feedback = input("Approve? (yes/no/[feedback]): ").strip()

        if feedback.lower() == "yes":
            state.values["approved"] = True
            app.update_state(config, state.values)
            return app.invoke(None, config=config)

        if feedback.lower() == "no":
            return {"status": "rejected", "iteration": iteration + 1}

        # Incorporate feedback and retry
        state.values["feedback"] = feedback
        state.values["iteration"] = iteration + 1
        app.update_state(config, state.values)

    return {"status": "max_iterations_reached", "final_state": state.values}
```

## When to Use

- Creative content refinement
- Iterative document editing
- AI-assisted writing workflows
- Quality improvement loops

## Anti-patterns

- No max iteration limit
- Ignoring previous feedback in prompts
- No progress indication
- Lost context between iterations