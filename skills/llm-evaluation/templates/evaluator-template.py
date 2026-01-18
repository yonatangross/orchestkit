"""
LLM Evaluation Template

Copy this template when creating new evaluation pipelines.
Replace placeholders with actual implementations.
"""

import asyncio
from typing import Any

import numpy as np
from scipy import stats

# =============================================================================
# Configuration
# =============================================================================

QUALITY_THRESHOLD = 0.7
JUDGE_MODEL = "gpt-4o-mini"  # Use different model than evaluated

QUALITY_DIMENSIONS = {
    "relevance": "How relevant is the output to the input?",
    "accuracy": "Are facts and claims correct?",
    "completeness": "Are all required aspects covered?",
    "coherence": "How well-structured and clear is the content?",
}


# =============================================================================
# Single Dimension Evaluation
# =============================================================================

async def evaluate_dimension(
    input_text: str,
    output_text: str,
    dimension: str,
    definition: str,
    llm_client: Any,
) -> float:
    """Evaluate output on a single dimension."""
    prompt = f"""Evaluate this output for {dimension}.

Definition: {definition}

Input: {input_text[:500]}
Output: {output_text[:1000]}

Score from 1-10 where:
1-3: Poor
4-6: Acceptable
7-8: Good
9-10: Excellent

Respond with just the number."""

    response = await llm_client.complete(
        model=JUDGE_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )

    try:
        score = int(response.content.strip())
        return score / 10  # Normalize to 0-1
    except ValueError:
        return 0.5  # Default on parse failure


# =============================================================================
# Multi-Dimension Evaluation
# =============================================================================

async def evaluate_all_dimensions(
    input_text: str,
    output_text: str,
    llm_client: Any,
) -> dict[str, float]:
    """Evaluate output on all dimensions in parallel."""
    tasks = [
        evaluate_dimension(input_text, output_text, dim, defn, llm_client)
        for dim, defn in QUALITY_DIMENSIONS.items()
    ]

    scores = await asyncio.gather(*tasks)

    result = dict(zip(QUALITY_DIMENSIONS.keys(), scores))
    result["average"] = sum(scores) / len(scores)

    return result


# =============================================================================
# Quality Gate
# =============================================================================

async def quality_gate(
    input_text: str,
    output_text: str,
    llm_client: Any,
    threshold: float = QUALITY_THRESHOLD,
) -> dict:
    """Evaluate and decide if output passes quality threshold."""
    scores = await evaluate_all_dimensions(input_text, output_text, llm_client)

    passed = scores["average"] >= threshold

    # Generate feedback for failed dimensions
    feedback = None
    if not passed:
        failed_dims = [
            dim for dim, score in scores.items()
            if dim != "average" and score < threshold
        ]
        feedback = f"Improve: {', '.join(failed_dims)}"

    return {
        "passed": passed,
        "scores": scores,
        "feedback": feedback,
    }


# =============================================================================
# Hallucination Detection
# =============================================================================

async def detect_hallucinations(
    context: str,
    output: str,
    llm_client: Any,
) -> dict:
    """Detect unsupported claims in output."""
    prompt = f"""Check if this output contains claims not supported by the context.

Context (source of truth):
{context}

Output to check:
{output}

List any claims NOT supported by the context.
If all claims are supported, respond with "NO_HALLUCINATIONS".

Format:
- Unsupported claim 1
- Unsupported claim 2
OR
NO_HALLUCINATIONS"""

    response = await llm_client.complete(
        model=JUDGE_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.content.strip()
    has_hallucinations = "NO_HALLUCINATIONS" not in content

    claims = []
    if has_hallucinations:
        claims = [
            line.strip("- ").strip()
            for line in content.split("\n")
            if line.strip().startswith("-")
        ]

    return {
        "has_hallucinations": has_hallucinations,
        "unsupported_claims": claims,
    }


# =============================================================================
# Batch Evaluation with Statistics
# =============================================================================

async def evaluate_batch(
    test_cases: list[dict],
    llm_client: Any,
) -> dict:
    """Evaluate multiple cases with statistical analysis."""
    results = []

    for case in test_cases:
        scores = await evaluate_all_dimensions(
            case["input"],
            case["output"],
            llm_client,
        )
        results.append(scores)

    # Calculate statistics
    avg_scores = [r["average"] for r in results]
    mean = np.mean(avg_scores)
    stderr = stats.sem(avg_scores)
    ci = stderr * stats.t.ppf(0.975, len(avg_scores) - 1)

    return {
        "total": len(results),
        "passed": sum(1 for r in results if r["average"] >= QUALITY_THRESHOLD),
        "pass_rate": sum(1 for r in results if r["average"] >= QUALITY_THRESHOLD) / len(results),
        "mean_score": mean,
        "ci_95_lower": mean - ci,
        "ci_95_upper": mean + ci,
        "by_dimension": {
            dim: np.mean([r[dim] for r in results])
            for dim in QUALITY_DIMENSIONS
        },
        "details": results,
    }


# =============================================================================
# Pairwise Comparison
# =============================================================================

async def compare_outputs(
    input_text: str,
    output_a: str,
    output_b: str,
    llm_client: Any,
) -> dict:
    """Compare two outputs and determine which is better."""
    prompt = f"""Compare these two responses to the same input.

Input: {input_text}

Response A:
{output_a}

Response B:
{output_b}

Which response is better? Consider relevance, accuracy, and clarity.
Respond with: A, B, or TIE followed by a brief explanation."""

    response = await llm_client.complete(
        model=JUDGE_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.content.strip()

    # Parse preference
    if content.upper().startswith("A"):
        winner = "A"
    elif content.upper().startswith("B"):
        winner = "B"
    else:
        winner = "TIE"

    return {
        "winner": winner,
        "explanation": content,
    }


# =============================================================================
# Observability Integration
# =============================================================================

def log_to_langfuse(trace_id: str, scores: dict, langfuse_client):
    """Log evaluation scores to Langfuse."""
    for dimension, score in scores.items():
        langfuse_client.score(
            trace_id=trace_id,
            name=f"eval_{dimension}",
            value=score,
        )


# =============================================================================
# Usage Example
# =============================================================================

"""
async def main():
    from your_llm_client import LLMClient
    
    llm = LLMClient()
    
    # Single evaluation
    result = await quality_gate(
        input_text="What is Python?",
        output_text="Python is a programming language.",
        llm_client=llm,
    )
    print(f"Passed: {result['passed']}, Score: {result['scores']['average']:.2f}")
    
    # Batch evaluation
    test_cases = [
        {"input": "Q1", "output": "A1"},
        {"input": "Q2", "output": "A2"},
    ]
    batch_result = await evaluate_batch(test_cases, llm)
    print(f"Pass rate: {batch_result['pass_rate']:.1%}")
    print(f"Mean score: {batch_result['mean_score']:.2f} ± {batch_result['ci_95_upper'] - batch_result['mean_score']:.2f}")
"""
