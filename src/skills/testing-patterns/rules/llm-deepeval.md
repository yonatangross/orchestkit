---
title: "LLM: DeepEval Quality"
category: llm
impact: HIGH
impactDescription: "Validates LLM output quality across multiple dimensions using automated metrics for relevancy, faithfulness, and hallucination"
tags: llm, deepeval, quality-metrics, rag, evaluation
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

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Quality metrics | Use multiple dimensions (3-5) |
| Schema validation | Test both valid and invalid |

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
