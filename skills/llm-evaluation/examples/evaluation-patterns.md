# LLM Evaluation Patterns

## LLM-as-Judge Pattern

```python
QUALITY_DIMENSIONS = {
    "relevance": "How relevant is the output to the input?",
    "accuracy": "Are facts and code snippets correct?",
    "completeness": "Are all required sections present?",
    "coherence": "How well-structured and clear is the content?",
}

async def evaluate_quality(
    input_text: str,
    output_text: str,
    dimension: str
) -> float:
    """Evaluate output quality on a specific dimension."""
    response = await llm.chat([{
        "role": "user",
        "content": f"""Evaluate this output for {dimension}.

Definition: {QUALITY_DIMENSIONS[dimension]}

Input: {input_text[:500]}
Output: {output_text[:1000]}

Score from 1-10 where:
1-3: Poor
4-6: Acceptable
7-8: Good
9-10: Excellent

Respond with just the number."""
    }])

    score = int(response.content.strip())
    return score / 10  # Normalize to 0-1
```

## Multi-Dimension Evaluation

```python
async def full_quality_assessment(
    input_text: str,
    output_text: str
) -> dict:
    """Evaluate across all quality dimensions."""
    scores = {}

    # Run evaluations in parallel
    tasks = [
        evaluate_quality(input_text, output_text, dim)
        for dim in QUALITY_DIMENSIONS
    ]
    results = await asyncio.gather(*tasks)

    for dim, score in zip(QUALITY_DIMENSIONS.keys(), results):
        scores[dim] = score

    scores["average"] = sum(scores.values()) / len(scores)
    return scores
```

## Quality Gate Node

```python
QUALITY_THRESHOLD = 0.7

async def quality_gate(state: dict) -> dict:
    """Block low-quality outputs in workflow."""
    scores = await full_quality_assessment(
        state["input"],
        state["output"]
    )

    passed = scores["average"] >= QUALITY_THRESHOLD

    return {
        **state,
        "quality_scores": scores,
        "quality_passed": passed,
        "quality_feedback": generate_feedback(scores) if not passed else None
    }

def generate_feedback(scores: dict) -> str:
    """Generate improvement suggestions for failed dimensions."""
    failed = [dim for dim, score in scores.items()
              if dim != "average" and score < QUALITY_THRESHOLD]

    return f"Improve these aspects: {', '.join(failed)}"
```

## Pairwise Comparison

```python
async def compare_outputs(
    input_text: str,
    output_a: str,
    output_b: str
) -> str:
    """Compare two outputs, return which is better."""
    response = await llm.chat([{
        "role": "user",
        "content": f"""Compare these two responses to the same input.

Input: {input_text}

Response A:
{output_a}

Response B:
{output_b}

Which response is better and why?
Respond with: A, B, or TIE followed by brief explanation."""
    }])

    return response.content
```

## Hallucination Detection

```python
async def detect_hallucination(
    context: str,
    output: str
) -> dict:
    """Check if output contains unsupported claims."""
    response = await llm.chat([{
        "role": "user",
        "content": f"""Check if this output contains claims not supported by the context.

Context (source of truth):
{context}

Output to check:
{output}

List any claims in the output that are NOT supported by the context.
If all claims are supported, respond with "NO_HALLUCINATIONS".

Format:
- Unsupported claim 1
- Unsupported claim 2
OR
NO_HALLUCINATIONS"""
    }])

    content = response.content.strip()
    has_hallucinations = "NO_HALLUCINATIONS" not in content

    return {
        "has_hallucinations": has_hallucinations,
        "unsupported_claims": parse_claims(content) if has_hallucinations else []
    }
```

## Batch Evaluation with Confidence Intervals

```python
import numpy as np
from scipy import stats

async def evaluate_batch(
    test_cases: list[dict]  # [{"input": ..., "output": ..., "expected": ...}]
) -> dict:
    """Evaluate multiple outputs with statistical analysis."""
    results = []

    for case in test_cases:
        scores = await full_quality_assessment(case["input"], case["output"])
        results.append(scores)

    # Calculate confidence intervals
    avg_scores = [r["average"] for r in results]
    mean = np.mean(avg_scores)
    stderr = stats.sem(avg_scores)
    ci = stderr * stats.t.ppf(0.975, len(avg_scores) - 1)

    return {
        "total": len(results),
        "passed": sum(1 for r in results if r["average"] >= QUALITY_THRESHOLD),
        "mean_score": mean,
        "ci_95": (mean - ci, mean + ci),
        "by_dimension": aggregate_by_dimension(results),
        "details": results
    }

def aggregate_by_dimension(results: list[dict]) -> dict:
    """Aggregate scores by dimension."""
    dimensions = [k for k in results[0].keys() if k != "average"]
    return {
        dim: np.mean([r[dim] for r in results])
        for dim in dimensions
    }
```

## Langfuse Integration

```python
from langfuse import Langfuse

langfuse = Langfuse()

async def evaluate_with_tracking(
    trace_id: str,
    input_text: str,
    output_text: str
):
    """Evaluate and log scores to Langfuse."""
    scores = await full_quality_assessment(input_text, output_text)

    # Log each dimension as a score
    for dimension, score in scores.items():
        if dimension != "average":
            langfuse.score(
                trace_id=trace_id,
                name=f"quality_{dimension}",
                value=score
            )

    langfuse.score(
        trace_id=trace_id,
        name="quality_overall",
        value=scores["average"]
    )

    return scores
```

## RAGAS Evaluation Pipeline

```python
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
from datasets import Dataset

async def evaluate_rag_pipeline(
    questions: list[str],
    answers: list[str],
    contexts: list[list[str]],
    ground_truths: list[str] | None = None,
) -> dict:
    """Evaluate RAG pipeline with RAGAS metrics."""
    
    data = {
        "question": questions,
        "answer": answers,
        "contexts": contexts,
    }
    
    if ground_truths:
        data["ground_truth"] = ground_truths

    dataset = Dataset.from_dict(data)

    metrics = [
        faithfulness,
        answer_relevancy,
        context_precision,
    ]
    
    if ground_truths:
        metrics.append(context_recall)

    result = evaluate(dataset, metrics=metrics)

    return {
        "faithfulness": result["faithfulness"],
        "answer_relevancy": result["answer_relevancy"],
        "context_precision": result["context_precision"],
        "context_recall": result.get("context_recall"),
        "overall": np.mean([
            result["faithfulness"],
            result["answer_relevancy"],
            result["context_precision"],
        ]),
    }
```

## A/B Testing Evaluation

```python
async def ab_test_models(
    test_cases: list[dict],
    model_a: str,
    model_b: str,
) -> dict:
    """Compare two models on the same test cases."""
    
    results_a = []
    results_b = []
    preferences = {"A": 0, "B": 0, "TIE": 0}

    for case in test_cases:
        # Get outputs from both models
        output_a = await generate(model_a, case["input"])
        output_b = await generate(model_b, case["input"])

        # Evaluate each
        score_a = await full_quality_assessment(case["input"], output_a)
        score_b = await full_quality_assessment(case["input"], output_b)

        results_a.append(score_a["average"])
        results_b.append(score_b["average"])

        # Pairwise comparison
        pref = await compare_outputs(case["input"], output_a, output_b)
        if "A" in pref[:5]:
            preferences["A"] += 1
        elif "B" in pref[:5]:
            preferences["B"] += 1
        else:
            preferences["TIE"] += 1

    # Statistical significance test
    from scipy.stats import ttest_rel
    t_stat, p_value = ttest_rel(results_a, results_b)

    return {
        "model_a_mean": np.mean(results_a),
        "model_b_mean": np.mean(results_b),
        "preferences": preferences,
        "p_value": p_value,
        "significant": p_value < 0.05,
        "winner": "A" if np.mean(results_a) > np.mean(results_b) else "B",
    }
```
