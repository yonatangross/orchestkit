# LLM Evaluation Metrics Reference

## RAGAS Metrics

### Faithfulness

Measures factual consistency between the generated answer and the retrieved context.

```python
from ragas.metrics import faithfulness

# Score 0-1, higher is better
# Checks: Are all claims in the answer supported by context?
```

**When to use:** RAG pipelines, fact-based Q&A, summarization

### Answer Relevancy

Measures how relevant the answer is to the question.

```python
from ragas.metrics import answer_relevancy

# Score 0-1, higher is better
# Penalizes: Incomplete answers, redundant information
```

**When to use:** Q&A systems, chatbots, search results

### Context Precision

Measures the relevance of retrieved contexts to the question.

```python
from ragas.metrics import context_precision

# Score 0-1, higher is better
# Checks: Are retrieved contexts useful for answering?
```

**When to use:** RAG retrieval evaluation, search ranking

### Context Recall

Measures if all relevant information was retrieved.

```python
from ragas.metrics import context_recall

# Score 0-1, higher is better
# Requires: ground_truth for comparison
```

**When to use:** RAG completeness evaluation

### Answer Correctness

Combines semantic similarity with factual correctness.

```python
from ragas.metrics import answer_correctness

# Score 0-1, higher is better
# Requires: ground_truth reference answer
```

**When to use:** Regression testing, benchmark evaluation

## LLM-as-Judge Dimensions

### Standard Dimensions

```python
QUALITY_DIMENSIONS = {
    "relevance": "How relevant is the output to the input?",
    "accuracy": "Are facts and code snippets correct?",
    "completeness": "Are all required sections present?",
    "coherence": "How well-structured and clear is the content?",
    "helpfulness": "How useful is this response to the user?",
}
```

### Domain-Specific Dimensions

```python
# Medical/Healthcare
MEDICAL_DIMENSIONS = {
    "clinical_accuracy": "Are medical facts correct?",
    "safety": "Are there any potentially harmful recommendations?",
    "actionability": "Are recommendations actionable?",
}

# Code Generation
CODE_DIMENSIONS = {
    "correctness": "Does the code work as intended?",
    "efficiency": "Is the code performant?",
    "maintainability": "Is the code readable and maintainable?",
    "security": "Are there security vulnerabilities?",
}
```

## Scoring Scales

### 1-10 Scale (Recommended)

```
1-3: Poor - Major issues, unusable
4-6: Acceptable - Functional with issues
7-8: Good - High quality with minor issues
9-10: Excellent - Near perfect
```

### Binary Scale

```
0: Fail - Does not meet criteria
1: Pass - Meets criteria
```

### Likert Scale (1-5)

```
1: Strongly Disagree
2: Disagree
3: Neutral
4: Agree
5: Strongly Agree
```

## Threshold Guidelines

| Use Case | Recommended Threshold |
|----------|----------------------|
| Production content | ≥ 0.8 |
| Draft content | ≥ 0.6 |
| Critical (medical, legal) | ≥ 0.9 |
| Experimental | ≥ 0.5 |

## Statistical Considerations

### Sample Size Requirements

| Confidence Level | Margin of Error | Sample Size |
|-----------------|-----------------|-------------|
| 95% | ±5% | 385 |
| 95% | ±10% | 97 |
| 90% | ±5% | 271 |
| 90% | ±10% | 68 |

### Confidence Interval Calculation

```python
import numpy as np
from scipy import stats

def confidence_interval(scores: list[float], confidence: float = 0.95):
    n = len(scores)
    mean = np.mean(scores)
    stderr = stats.sem(scores)
    h = stderr * stats.t.ppf((1 + confidence) / 2, n - 1)
    return mean, mean - h, mean + h
```

## LangSmith Dataset Management

### Create Evaluation Dataset

```python
from langsmith import Client

client = Client()

# Create dataset
dataset = client.create_dataset(
    dataset_name="qa-evaluation",
    description="Q&A evaluation dataset",
)

# Add examples
client.create_examples(
    inputs=[{"question": "What is Python?"}],
    outputs=[{"answer": "A programming language"}],
    dataset_id=dataset.id,
)
```

### Run Evaluation

```python
from langsmith.evaluation import evaluate

def answer_correctly(run, example):
    """Custom evaluator."""
    prediction = run.outputs["answer"]
    reference = example.outputs["answer"]
    # Return score 0-1
    return {"score": similarity(prediction, reference)}

results = evaluate(
    my_chain,
    data="qa-evaluation",
    evaluators=[answer_correctly],
)
```

## Langfuse Scoring

```python
from langfuse import Langfuse

langfuse = Langfuse()

# Log scores to trace
langfuse.score(
    trace_id=trace_id,
    name="quality_overall",
    value=0.85,
    comment="High quality response",
)

# Log categorical score
langfuse.score(
    trace_id=trace_id,
    name="safety",
    value="safe",  # Categorical
)
```

## External Links

- [RAGAS Documentation](https://docs.ragas.io/)
- [LangSmith Evaluation](https://docs.smith.langchain.com/evaluation)
- [Langfuse Scoring](https://langfuse.com/docs/scores)
- [Anthropic Evaluation Guide](https://docs.anthropic.com/claude/docs/evaluations)
