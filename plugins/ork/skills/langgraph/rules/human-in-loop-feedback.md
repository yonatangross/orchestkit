---
title: Feedback Loop Pattern
impact: MEDIUM
impactDescription: "Feedback without iteration just collects comments — use loop for iterative refinement"
tags: human-in-loop, feedback, loop, iteration, refinement
---

## Feedback Loop Pattern

Repeatedly interrupt until human approves, incorporating feedback each iteration.

**Incorrect — single feedback, no iteration:**
```python
def review(state):
    feedback = get_human_feedback()
    state["feedback"] = feedback
    # Proceeds regardless of whether human approved
```

**Correct — iterative feedback loop:**
```python
from langgraph.types import interrupt, Command

async def run_with_feedback(initial_state: dict):
    config = {"configurable": {"thread_id": str(uuid.uuid4())}}

    while True:
        result = app.invoke(initial_state, config=config)

        if "__interrupt__" not in result:
            return result  # Completed without interrupt

        info = result["__interrupt__"][0].value
        print(f"Output: {info.get('output', 'N/A')}")
        feedback = input("Approve? (yes/no/feedback): ")

        if feedback.lower() == "yes":
            return app.invoke(Command(resume={"approved": True}), config=config)
        elif feedback.lower() == "no":
            return {"status": "rejected"}
        else:
            # Incorporate feedback and retry
            initial_state = None
            app.invoke(
                Command(resume={"approved": False, "feedback": feedback}),
                config=config
            )
```

**Input validation loop:**
```python
def get_valid_age(state):
    prompt = "What is your age?"
    while True:
        answer = interrupt(prompt)
        if isinstance(answer, int) and 0 < answer < 150:
            return {"age": answer}
        prompt = f"'{answer}' is not valid. Enter 1-150."
```

**Key rules:**
- Track `review_count` to limit iterations
- Pass rejection feedback back to generation node
- Preserve approved partial results between iterations
- Timeout after max iterations with best-effort result

Reference: [LangGraph Human-in-the-Loop](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/)
