---
title: Test and version prompts systematically to prevent silent production regressions
impact: HIGH
impactDescription: "Untested prompts fail silently in production; versioning and optimization prevent regressions"
tags: prompts, versioning, dspy, optimization, langfuse, a-b-testing
---

## Prompt Testing and Optimization

**Incorrect -- deploying prompts without testing or versioning:**
```python
# Hardcoded prompt, no version control, no A/B testing
PROMPT = "You are a helpful assistant..."
response = llm.complete(PROMPT + user_input)
# No way to know if prompt changes improve or degrade quality
```

**Correct -- prompt versioning with Langfuse SDK v3:**
```python
from langfuse import Langfuse

langfuse = Langfuse()

# Get versioned prompt with environment label
prompt = langfuse.get_prompt(
    name="customer-support-v2",
    label="production",  # production, staging, canary
    cache_ttl_seconds=300,
)

# Compile with variables
compiled = prompt.compile(
    customer_name="John",
    issue="billing question"
)

# Track via trace metadata for A/B comparison
trace = langfuse.trace(
    name="support-query",
    metadata={"prompt_version": prompt.version, "variant": "A"},
)
```

**Correct -- DSPy 3.1.0 automatic prompt optimization:**
```python
import dspy

class OptimizedQA(dspy.Module):
    def __init__(self):
        self.generate = dspy.Predict("question -> answer")

    def forward(self, question):
        return self.generate(question=question)

# MIPROv2: Data+demo-aware Bayesian optimization (recommended)
optimizer = dspy.MIPROv2(metric=answer_match)
optimized = optimizer.compile(OptimizedQA(), trainset=examples)

# Alternative: GEPA (July 2025) - Reflective Prompt Evolution
# Uses model introspection to analyze failures and propose better prompts
```

**Correct -- self-consistency for hard problems:**
```python
async def self_consistent_answer(question: str, n_paths: int = 5) -> str:
    """Generate multiple CoT reasoning paths and vote on answer."""
    answers = []
    for _ in range(n_paths):
        response = await llm.chat([{
            "role": "user",
            "content": f"{question}\n\nThink step by step."
        }], temperature=0.7)  # Higher temp for diversity
        answer = extract_final_answer(response)
        answers.append(answer)

    # Majority vote
    from collections import Counter
    return Counter(answers).most_common(1)[0][0]
```

Key decisions:
- Prompt versioning: Langfuse with labels (production/staging)
- A/B testing: 50+ samples, track via trace metadata
- Auto-optimization: DSPy MIPROv2 for few-shot tuning
- Self-consistency: 5 paths for hard reasoning problems
