---
title: Prompt Design Patterns
impact: HIGH
impactDescription: "Effective prompt design improves LLM accuracy by 20-40% on complex reasoning tasks"
tags: prompts, chain-of-thought, few-shot, zero-shot, structured-output
---

## Prompt Design Patterns

**Incorrect -- unstructured prompting for complex tasks:**
```python
# No reasoning structure for complex problems
response = llm.complete("Solve: 15% of 240")  # No CoT!

# Single example for few-shot (too few)
examples = [{"input": "x", "output": "y"}]

# Hardcoded prompt without versioning
PROMPT = "You are a helpful assistant..."  # No version control!
```

**Correct -- Chain-of-Thought for reasoning tasks:**
```python
COT_SYSTEM = """You are a helpful assistant that solves problems step-by-step.

When solving problems:
1. Break down the problem into clear steps
2. Show your reasoning for each step
3. Verify your answer before responding
4. If uncertain, acknowledge limitations

Format your response as:
STEP 1: [description]
Reasoning: [your thought process]
FINAL ANSWER: [your conclusion]"""

cot_prompt = ChatPromptTemplate.from_messages([
    ("system", COT_SYSTEM),
    ("human", "Problem: {problem}\n\nThink through this step-by-step."),
])
```

**Correct -- few-shot with 3-5 diverse examples:**
```python
from langchain_core.prompts import FewShotChatMessagePromptTemplate

# Use 3-5 diverse, representative examples
examples = [ex1, ex2, ex3, ex4, ex5]

few_shot = FewShotChatMessagePromptTemplate(
    examples=examples,
    example_prompt=ChatPromptTemplate.from_messages([
        ("human", "{input}"),
        ("ai", "{output}"),
    ]),
)

# Most similar examples last (recency bias helps)
final_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant. Answer concisely."),
    few_shot,
    ("human", "{input}"),
])
```

**Pattern selection guide:**

| Pattern | When to Use | Example Use Case |
|---------|-------------|------------------|
| Zero-shot | Simple, well-defined tasks | Classification, extraction |
| Few-shot | Complex tasks needing examples | Format conversion, style matching |
| CoT | Reasoning, math, logic | Problem solving, analysis |
| Zero-shot CoT | Quick reasoning boost | Add "Let's think step by step" |
| ReAct | Tool use, multi-step | Agent tasks, API calls |
| Structured | JSON/schema output | Data extraction, API responses |

Key decisions:
- Few-shot examples: 3-5 diverse, representative examples
- Example ordering: most similar examples last (recency bias)
- CoT trigger: "Let's think step by step" or explicit format
- Always use CoT for math/logic tasks
