---
title: Detect silent quality degradation in agent outputs that pass basic error checks
impact: HIGH
impactDescription: "Agents producing gibberish or repetitive output pass basic checks — quality scoring catches what error handling misses"
tags: monitoring, silent-failure, quality, gibberish, degradation, llm-judge
---

## Silent Quality Degradation Detection

Detect gibberish, repetitive, or low-quality LLM outputs that pass basic checks.

**Incorrect — checking only for emptiness:**
```python
if len(response) > 0:  # Not-empty is not correct
    return response     # Gibberish passes this check
```

**Correct — heuristic pre-filter + LLM-as-judge:**
```python
from langfuse import observe, get_client

@observe(name="quality_check")
async def detect_degraded_quality(response: str) -> dict:
    # Quick heuristics first (cheap, fast)
    if len(response) < 10:
        return {"alert": True, "type": "too_short"}

    # Repetition check: ratio of unique words to total words
    words = response.split()
    if len(words) > 0 and len(set(words)) / len(words) < 0.3:
        return {"alert": True, "type": "repetitive"}

    # LLM-as-judge for semantic quality (more expensive, run second)
    judge_prompt = f"""Rate this response quality (0-1):
    - 0: Gibberish, nonsensical, or completely wrong
    - 0.5: Partially correct but missing key information
    - 1: High quality, accurate, complete
    Response: {response[:1000]}
    Score (just the number):"""

    score = await llm.generate(judge_prompt)
    score_value = float(score.strip())
    get_client().score_current_trace(name="quality_check", value=score_value)

    if score_value < 0.5:
        return {"alert": True, "type": "low_quality", "score": score_value}
    return {"alert": False, "score": score_value}
```

**Loop and token spike detection:**
```python
class LoopDetector:
    def __init__(self, max_iterations=10, token_spike_multiplier=3.0):
        self.max_iterations = max_iterations
        self.token_spike_multiplier = token_spike_multiplier
        self.iteration_count = 0
        self.total_tokens = 0
        self.baseline_tokens = 2000

    def check(self, tokens_used: int) -> dict:
        self.iteration_count += 1
        self.total_tokens += tokens_used
        if self.iteration_count > self.max_iterations:
            return {"alert": True, "type": "max_iterations"}
        expected = self.baseline_tokens * self.iteration_count
        if self.total_tokens > expected * self.token_spike_multiplier:
            return {"alert": True, "type": "token_spike",
                    "tokens": self.total_tokens, "expected": expected}
        return {"alert": False}
```

**Key rules:**
- Layer detection: heuristics first (cheap), then LLM-as-judge (accurate)
- Track unique-word ratio — below 0.3 indicates repetitive/stuck output
- Monitor token consumption per iteration — 3x baseline indicates infinite loop
- Log quality scores to Langfuse for trend analysis and drift detection
- Not-empty and no-error are insufficient quality checks
