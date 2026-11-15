---
title: Implement ReAct pattern for tool-using agents with structured thought-action-observation loops
impact: HIGH
impactDescription: "ReAct pattern prevents agents from acting without reasoning, reducing errors in multi-step tool use"
tags: react, agent, tool-use, reasoning, action
---

## ReAct Pattern for Tool-Using Agents

**Incorrect -- direct tool calling without reasoning:**
```python
# Agent calls tools without explicit reasoning steps
def agent_run(query: str):
    # Immediately calls a tool with no thought process
    result = search_tool(query)
    return result  # No verification, no reasoning trace
```

**Correct -- ReAct loop with explicit thought steps:**

### System Prompt Template

```python
REACT_SYSTEM = """You are a helpful assistant with access to tools.

For each step, use this exact format:

Thought: [reason about what to do next based on the question and observations so far]
Action: [tool_name]
Action Input: [input for the tool as valid JSON]
Observation: [tool result -- filled in by the system]
... (repeat Thought/Action/Observation as needed)
Thought: I now have enough information to answer.
Final Answer: [your complete answer to the original question]

Rules:
- ALWAYS start with a Thought before any Action.
- NEVER call a tool without explaining why in the Thought.
- If an Observation is unexpected, reason about it before the next Action.
- Stop after at most 5 iterations to avoid runaway loops."""
```

### Python Implementation

```python
import json
from typing import Callable

TOOLS: dict[str, Callable] = {
    "search": search_documents,
    "calculate": run_calculation,
    "lookup": database_lookup,
}

async def react_loop(query: str, max_steps: int = 5) -> str:
    messages = [
        {"role": "system", "content": REACT_SYSTEM},
        {"role": "user", "content": query},
    ]

    for step in range(max_steps):
        response = await llm.chat(messages, stop=["Observation:"])
        text = response.content

        if "Final Answer:" in text:
            return text.split("Final Answer:")[-1].strip()

        # Parse Action and Action Input
        action = parse_field(text, "Action")
        action_input = parse_field(text, "Action Input")

        if action not in TOOLS:
            observation = f"Error: Unknown tool '{action}'. Available: {list(TOOLS.keys())}"
        else:
            observation = TOOLS[action](json.loads(action_input))

        messages.append({"role": "assistant", "content": text})
        messages.append({"role": "user", "content": f"Observation: {observation}"})

    return "Max steps reached. Unable to determine a final answer."
```

### When to Use Each Pattern

| Pattern | Best For | Trade-off |
|---------|----------|-----------|
| Simple tool calling | Single-tool, low-ambiguity tasks | Fast but no reasoning trace |
| Chain-of-Thought | Reasoning without tool use | Good reasoning, no actions |
| ReAct | Multi-step tasks requiring tools + reasoning | Slower but auditable and accurate |
| ReAct + self-consistency | High-stakes multi-tool decisions | Most reliable, highest cost |

Key decisions:
- Use ReAct when the agent needs 2+ tools or multi-step reasoning with tools
- Cap iterations (5 is a good default) to prevent runaway loops
- Always log the full Thought/Action/Observation trace for debugging
- Prefer simple tool calling for single-tool, deterministic tasks
