---
title: Optimize prompts for token efficiency, accuracy, and cost through systematic techniques
impact: HIGH
impactDescription: "Unoptimized prompts waste 30-50% of tokens and cost; systematic optimization reduces both"
tags: optimization, tokens, cost, accuracy, consistency
---

## Prompt Optimization

**Incorrect -- one-size-fits-all prompting:**
```python
# Same expensive model for every task
response = await claude_opus.chat(system="You are a helpful assistant.", message=query)

# Verbose, redundant system prompt wasting tokens
SYSTEM = """You are a very helpful and extremely knowledgeable assistant.
You are very good at answering questions. You always try your best to help.
You are an expert in many fields. You provide detailed answers.
Please make sure to be helpful and answer the question."""  # ~50 tokens of fluff
```

**Correct -- tiered optimization by task complexity.**

### Token Reduction Techniques

| Technique | Before | After | Savings |
|-----------|--------|-------|---------|
| Remove redundancy | "You are a helpful assistant that helps users" | "You are a helpful assistant" | ~30% |
| Concise instructions | "Please make sure to always format your response as JSON" | "Respond in JSON" | ~60% |
| Leverage implicit knowledge | "JSON is a format that uses key-value pairs..." | (omit -- LLMs know JSON) | 100% |
| Reference by name | Full schema inline every call | "Use the CustomerOrder schema" | ~80% |

### Accuracy Improvement

```python
# Add explicit constraints to reduce hallucination
CONSTRAINED_SYSTEM = """Answer using ONLY the provided context.
If the context doesn't contain the answer, say "Not found in context."
Never infer beyond what is explicitly stated.

CONTEXT:
{context}"""

# Add negative examples to clarify boundaries
FEW_SHOT_WITH_NEGATIVES = """
Example (CORRECT): Input: "2+2" -> Output: {"answer": 4, "confidence": 1.0}
Example (INCORRECT): Input: "meaning of life" -> Output: {"answer": 42}
  Why incorrect: question is philosophical, not mathematical. Correct: {"error": "not a math question"}
"""

# Self-verification step
VERIFY_PROMPT = """First, answer the question. Then, review your answer and check:
1. Does it directly address the question?
2. Is every claim supported by the provided context?
3. Are there any logical errors?
If you find issues, correct them before giving your Final Answer."""
```

### Consistency Patterns

```python
# Enforce structured output
response = await llm.chat(
    messages=messages,
    response_format={"type": "json_object"},  # JSON mode
    temperature=0.0,  # Deterministic for structured tasks
)

# Explicit output format reduces variance
FORMAT_PROMPT = """Respond in exactly this JSON format, no other text:
{
  "answer": "<string>",
  "confidence": <float 0-1>,
  "sources": ["<source1>", "<source2>"]
}"""
```

### Cost Optimization: Model Tiering

| Task Complexity | Model Tier | Examples | Est. Cost/1K calls |
|----------------|------------|----------|---------------------|
| Simple | Haiku / GPT-4o-mini | Classification, extraction, formatting | $0.02 |
| Medium | Sonnet / GPT-4o | Summarization, Q&A, code review | $0.30 |
| Complex | Opus / o1 | Multi-step reasoning, creative writing, architecture | $1.50 |

```python
# Model router based on task complexity
def select_model(task_type: str) -> str:
    TIER_MAP = {
        "classify": "claude-haiku",
        "extract": "claude-haiku",
        "summarize": "claude-sonnet",
        "qa": "claude-sonnet",
        "reason": "claude-opus",
        "architect": "claude-opus",
    }
    return TIER_MAP.get(task_type, "claude-sonnet")
```

### Prompt Specification Template

```yaml
# Prompt Spec: [name]
version: "1.0"
pattern: "CoT | few-shot | ReAct | zero-shot"
model_tier: "haiku | sonnet | opus"
est_tokens_per_call: 500
est_cost_per_1k_calls: "$0.30"

system_prompt: |
  [system prompt text]

user_template: |
  [user message template with {variables}]

example_io:
  - input: "sample input"
    output: "expected output"

testing_checklist:
  - [ ] 50+ eval samples pass quality threshold
  - [ ] Token count within budget
  - [ ] Latency under SLA (p95)
  - [ ] A/B test vs previous version

known_limitations:
  - "Does not handle [edge case]"
```

Key decisions:
- Always tier models by task complexity -- never use Opus for classification
- Remove prompt fluff: aim for <200 tokens in system prompts
- Use JSON mode + temperature=0 for structured output consistency
- Maintain a prompt spec for every production prompt
- Batch API calls where possible (50% cost reduction on most providers)
- Cache identical prompts to avoid redundant calls
