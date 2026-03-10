---
title: Validate LLM output quality and structured schemas using DeepEval metrics and Pydantic testing
category: llm
impact: HIGH
impactDescription: "Validates LLM output quality across multiple dimensions using automated metrics, schema validation, and timeout behavior testing"
tags: llm, deepeval, quality-metrics, rag, evaluation, structured-output, pydantic, timeout, schema-validation
---

# DeepEval Quality Testing

```python
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric

test_case = LLMTestCase(
    input="What is the capital of France?",
    actual_output="The capital of France is Paris.",
    retrieval_context=["Paris is the capital of France."],
)

metrics = [
    AnswerRelevancyMetric(threshold=0.7),
    FaithfulnessMetric(threshold=0.8),
]

assert_test(test_case, metrics)
```

## Quality Metrics

| Metric | Threshold | Purpose |
|--------|-----------|---------|
| Answer Relevancy | >= 0.7 | Response addresses question |
| Faithfulness | >= 0.8 | Output matches context |
| Hallucination | <= 0.3 | No fabricated facts |
| Context Precision | >= 0.7 | Retrieved contexts relevant |

**Incorrect — Testing only the output exists:**
```python
def test_llm_response():
    result = get_llm_answer("What is Paris?")
    assert result is not None
    # No quality validation
```

**Correct — Testing multiple quality dimensions:**
```python
test_case = LLMTestCase(
    input="What is the capital of France?",
    actual_output="The capital of France is Paris.",
    retrieval_context=["Paris is the capital of France."]
)
assert_test(test_case, [
    AnswerRelevancyMetric(threshold=0.7),
    FaithfulnessMetric(threshold=0.8)
])
```

---

# Structured Output and Timeout Testing

## Timeout Testing

```python
import asyncio
import pytest

@pytest.mark.asyncio
async def test_respects_timeout():
    with pytest.raises(asyncio.TimeoutError):
        async with asyncio.timeout(0.1):
            await slow_llm_call()
```

## Schema Validation

```python
from pydantic import BaseModel, Field

class LLMResponse(BaseModel):
    answer: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    sources: list[str] = Field(default_factory=list)

@pytest.mark.asyncio
async def test_structured_output():
    result = await get_llm_response("test query")
    parsed = LLMResponse.model_validate(result)
    assert parsed.confidence > 0
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Quality metrics | Use multiple dimensions (3-5) |
| Schema validation | Test both valid and invalid |
| Timeout | Always test with < 1s timeout |
| Edge cases | Test all null/empty paths |

**Incorrect — No schema validation on LLM output:**
```python
async def test_llm_response():
    result = await get_llm_response("test query")
    assert result["answer"]  # Crashes if "answer" missing
    assert result["confidence"] > 0  # No type checking
```

**Correct — Pydantic validation ensures schema correctness:**
```python
class LLMResponse(BaseModel):
    answer: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)

async def test_structured_output():
    result = await get_llm_response("test query")
    parsed = LLMResponse.model_validate(result)
    assert 0 <= parsed.confidence <= 1.0
```
