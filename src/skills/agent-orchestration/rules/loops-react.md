---
title: Implement ReAct pattern where agents reason, act via tools, observe, and iterate
category: loops
impact: HIGH
impactDescription: "Ensures agents reason step-by-step, take actions via tools, observe results, and iterate until reaching a final answer"
tags: react, reasoning, tools, self-correction, memory
---

# ReAct Pattern (Reasoning + Acting)

LLMs reason step-by-step, take actions via tools, observe results, and iterate until a final answer is reached.

## ReAct Prompt Template

```python
REACT_PROMPT = """You are an agent that reasons step by step.

For each step, respond with:
Thought: [your reasoning about what to do next]
Action: [tool_name(arg1, arg2)]
Observation: [you'll see the result here]

When you have the final answer:
Thought: I now have enough information
Final Answer: [your response]

Available tools: {tools}

Question: {question}
"""
```

## Python Implementation

```python
async def react_loop(question: str, tools: dict, max_steps: int = 10) -> str:
    """Execute ReAct reasoning loop."""
    history = REACT_PROMPT.format(tools=list(tools.keys()), question=question)

    for step in range(max_steps):
        response = await llm.chat([{"role": "user", "content": history}])
        history += response.content

        # Check for final answer
        if "Final Answer:" in response.content:
            return response.content.split("Final Answer:")[-1].strip()

        # Extract and execute action
        if "Action:" in response.content:
            action = parse_action(response.content)
            result = await tools[action.name](*action.args)
            history += f"\nObservation: {result}\n"

    return "Max steps reached without answer"
```

## Self-Correction Loop

```python
async def self_correcting_agent(task: str, max_retries: int = 3) -> str:
    """Agent that validates and corrects its own output."""
    for attempt in range(max_retries):
        response = await llm.chat([{"role": "user", "content": task}])

        # Self-validate
        validation = await llm.chat([{
            "role": "user",
            "content": f"""Validate this response for the task: {task}

Response: {response.content}

Check for:
1. Correctness - Is it factually accurate?
2. Completeness - Does it fully answer the task?
3. Format - Is it properly formatted?

If valid, respond: VALID
If invalid, respond: INVALID: [what's wrong and how to fix]"""
        }])

        if "VALID" in validation.content:
            return response.content

        # Correct based on feedback
        task = f"{task}\n\nPrevious attempt had issues: {validation.content}"

    return response.content  # Return best attempt
```

## Memory Management

```python
class AgentMemory:
    """Sliding window memory for agents."""

    def __init__(self, max_messages: int = 20):
        self.messages = []
        self.max_messages = max_messages
        self.summary = ""

    def add(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        if len(self.messages) > self.max_messages:
            self._compress()

    def _compress(self):
        """Summarize oldest messages."""
        old = self.messages[:10]
        self.messages = self.messages[10:]
        summary = summarize(old)
        self.summary = f"{self.summary}\n{summary}"

    def get_context(self) -> list:
        """Get messages with summary prefix."""
        context = []
        if self.summary:
            context.append({
                "role": "system",
                "content": f"Previous context summary: {self.summary}"
            })
        return context + self.messages
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Max steps | 5-15 (prevent infinite loops) |
| Temperature | 0.3-0.7 (balance creativity/focus) |
| Memory window | 10-20 messages |
| Validation frequency | Every 3-5 steps |

## Common Mistakes

- No step limit (infinite loops)
- No memory management (context overflow)
- No error recovery (crashes on tool failure)
- Over-complex prompts (agent gets confused)

**Incorrect — ReAct loop without step limit:**
```python
async def react_loop(question: str, tools: dict):
    history = f"Question: {question}"
    while True:  # Infinite loop risk
        response = await llm.chat([{"role": "user", "content": history}])
        if "Final Answer:" in response.content:
            return response.content
```

**Correct — max_steps prevents infinite loops:**
```python
async def react_loop(question: str, tools: dict, max_steps: int = 10):
    history = f"Question: {question}"
    for step in range(max_steps):  # Bounded loop
        response = await llm.chat([{"role": "user", "content": history}])
        if "Final Answer:" in response.content:
            return response.content.split("Final Answer:")[-1]
    return "Max steps reached without answer"
```
