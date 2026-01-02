---
name: llm-evaluation
description: LLM output evaluation and quality assessment. Use when implementing LLM-as-judge patterns, quality gates for AI outputs, or automated evaluation pipelines.
---

# LLM Evaluation

Evaluate and validate LLM outputs for quality assurance.

## When to Use

- Quality gates before publishing AI content
- Automated testing of LLM outputs
- Comparing model performance
- Detecting hallucinations or low-quality responses

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

## Batch Evaluation

```python
async def evaluate_batch(
    test_cases: list[dict]  # [{"input": ..., "output": ..., "expected": ...}]
) -> dict:
    """Evaluate multiple outputs and aggregate metrics."""
    results = []

    for case in test_cases:
        scores = await full_quality_assessment(case["input"], case["output"])

        # Optional: Compare to expected output
        if case.get("expected"):
            similarity = await compare_outputs(
                case["input"],
                case["output"],
                case["expected"]
            )
            scores["vs_expected"] = similarity

        results.append(scores)

    # Aggregate
    return {
        "total": len(results),
        "passed": sum(1 for r in results if r["average"] >= QUALITY_THRESHOLD),
        "avg_score": sum(r["average"] for r in results) / len(results),
        "by_dimension": aggregate_by_dimension(results),
        "details": results
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

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Judge model | GPT-4o-mini or Claude Haiku (cost-effective) |
| Threshold | 0.7 for production, 0.6 for drafts |
| Dimensions | 3-5 most relevant to your use case |
| Sample size | Evaluate 100+ for reliable metrics |

## Common Mistakes

- Using same model to judge its own output (bias)
- Single dimension evaluation (incomplete picture)
- No baseline comparison (can't track improvement)
- Threshold too high (blocks good content)

## Related Skills

- `quality-gates` - Workflow quality control
- `langfuse-observability` - Tracking evaluation scores
- `agent-loops` - Self-correcting with evaluation
