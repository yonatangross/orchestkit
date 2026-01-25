# DeepEval & RAGAS API Reference

## DeepEval Setup

```bash
pip install deepeval
```

### Core Metrics

```python
from deepeval import assert_test
from deepeval.metrics import (
    AnswerRelevancyMetric,
    FaithfulnessMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
    GEvalMetric,
    SummarizationMetric,
    HallucinationMetric,
)
from deepeval.test_case import LLMTestCase

# Create test case
test_case = LLMTestCase(
    input="What is the capital of France?",
    actual_output="The capital of France is Paris.",
    expected_output="Paris",
    context=["France is a country in Europe. Its capital is Paris."],
    retrieval_context=["Paris is the capital and largest city of France."],
)
```

### Answer Relevancy

```python
from deepeval.metrics import AnswerRelevancyMetric

metric = AnswerRelevancyMetric(
    threshold=0.7,
    model="gpt-4o-mini",
    include_reason=True,
)

metric.measure(test_case)
print(f"Score: {metric.score}")
print(f"Reason: {metric.reason}")
```

### Faithfulness

```python
from deepeval.metrics import FaithfulnessMetric

metric = FaithfulnessMetric(
    threshold=0.8,
    model="gpt-4o-mini",
)

# Measures if output is faithful to the context
metric.measure(test_case)
```

### Contextual Precision & Recall

```python
from deepeval.metrics import ContextualPrecisionMetric, ContextualRecallMetric

# Precision: Are retrieved contexts relevant?
precision_metric = ContextualPrecisionMetric(threshold=0.7)

# Recall: Did we retrieve all relevant contexts?
recall_metric = ContextualRecallMetric(threshold=0.7)
```

### G-Eval (Custom Criteria)

```python
from deepeval.metrics import GEvalMetric

# Custom evaluation criteria
coherence_metric = GEvalMetric(
    name="Coherence",
    criteria="Determine if the response is logically coherent and well-structured.",
    evaluation_steps=[
        "Check if ideas flow logically",
        "Verify sentence structure is clear",
        "Assess overall organization",
    ],
    threshold=0.7,
)
```

### Hallucination Detection

```python
from deepeval.metrics import HallucinationMetric

hallucination_metric = HallucinationMetric(
    threshold=0.5,  # Lower is better (0 = no hallucination)
    model="gpt-4o-mini",
)

test_case = LLMTestCase(
    input="What is the population of Paris?",
    actual_output="Paris has a population of 15 million people.",
    context=["Paris has a population of approximately 2.1 million."],
)

hallucination_metric.measure(test_case)
# score close to 1 = hallucination detected
```

### Summarization

```python
from deepeval.metrics import SummarizationMetric

metric = SummarizationMetric(
    threshold=0.7,
    model="gpt-4o-mini",
    assessment_questions=[
        "Does the summary capture the main points?",
        "Is the summary concise?",
        "Does it maintain factual accuracy?",
    ],
)
```

## RAGAS Setup

```bash
pip install ragas
```

### Core Metrics

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
    answer_similarity,
    answer_correctness,
)
from datasets import Dataset

# Prepare dataset
data = {
    "question": ["What is the capital of France?"],
    "answer": ["The capital of France is Paris."],
    "contexts": [["France is a country in Europe. Its capital is Paris."]],
    "ground_truth": ["Paris is the capital of France."],
}

dataset = Dataset.from_dict(data)

# Evaluate
result = evaluate(
    dataset,
    metrics=[
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall,
    ],
)

print(result)
# {'faithfulness': 0.95, 'answer_relevancy': 0.88, ...}
```

### Faithfulness (RAGAS)

```python
from ragas.metrics import faithfulness

# Measures factual consistency between answer and context
# Score 0-1, higher is better
```

### Answer Relevancy (RAGAS)

```python
from ragas.metrics import answer_relevancy

# Measures how relevant the answer is to the question
# Penalizes incomplete or redundant answers
```

### Context Precision & Recall

```python
from ragas.metrics import context_precision, context_recall

# Precision: relevance of retrieved contexts
# Recall: coverage of ground truth by contexts
```

### Answer Correctness

```python
from ragas.metrics import answer_correctness

# Combines semantic similarity with factual correctness
# Requires ground_truth in dataset
```

## pytest Integration

### DeepEval with pytest

```python
# test_llm.py
import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric

@pytest.mark.asyncio
async def test_answer_relevancy():
    """Test that LLM responses are relevant to questions."""
    response = await llm_client.complete("What is Python?")
    
    test_case = LLMTestCase(
        input="What is Python?",
        actual_output=response.content,
    )
    
    metric = AnswerRelevancyMetric(threshold=0.7)
    
    assert_test(test_case, [metric])
```

### RAGAS with pytest

```python
# test_rag.py
import pytest
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy
from datasets import Dataset

@pytest.mark.asyncio
async def test_rag_pipeline():
    """Test RAG pipeline quality."""
    question = "What are the benefits of exercise?"
    contexts = await retriever.retrieve(question)
    answer = await generator.generate(question, contexts)
    
    dataset = Dataset.from_dict({
        "question": [question],
        "answer": [answer],
        "contexts": [contexts],
    })
    
    result = evaluate(dataset, metrics=[faithfulness, answer_relevancy])
    
    assert result["faithfulness"] >= 0.7
    assert result["answer_relevancy"] >= 0.7
```

## Batch Evaluation

```python
from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric

# Create multiple test cases
test_cases = [
    LLMTestCase(
        input=q["question"],
        actual_output=q["response"],
        context=q["context"],
    )
    for q in test_dataset
]

# Evaluate batch
metrics = [
    AnswerRelevancyMetric(threshold=0.7),
    FaithfulnessMetric(threshold=0.8),
]

results = evaluate(test_cases, metrics)
print(results)  # Aggregated scores
```

## Confidence Intervals

```python
import numpy as np
from scipy import stats

def calculate_confidence_interval(scores: list[float], confidence: float = 0.95):
    """Calculate confidence interval for metric scores."""
    n = len(scores)
    mean = np.mean(scores)
    stderr = stats.sem(scores)
    h = stderr * stats.t.ppf((1 + confidence) / 2, n - 1)
    return mean, mean - h, mean + h

# Usage
scores = [0.85, 0.78, 0.92, 0.81, 0.88]
mean, lower, upper = calculate_confidence_interval(scores)
print(f"Mean: {mean:.2f}, 95% CI: [{lower:.2f}, {upper:.2f}]")
```

## External Links

- [DeepEval Documentation](https://docs.confident-ai.com/)
- [RAGAS Documentation](https://docs.ragas.io/)
- [LLM Evaluation Best Practices](https://www.anthropic.com/research/evaluations)
