---
title: LLM Evaluation Benchmarks and Quality Gates
impact: HIGH
impactDescription: "Quality gates prevent low-quality LLM outputs from reaching production users"
tags: evaluation, quality-gate, batch-eval, pairwise, benchmarks
---

## LLM Evaluation Benchmarks and Quality Gates

**Incorrect -- no quality gate on LLM output:**
```python
# Returning raw LLM output without validation
response = await llm.generate(prompt)
return response  # No quality check!
```

**Correct -- quality gate with multi-metric assessment:**
```python
QUALITY_THRESHOLD = 0.7

async def quality_gate(state: dict) -> dict:
    """Gate LLM output with multi-metric assessment."""
    scores = await full_quality_assessment(state["input"], state["output"])
    passed = scores["average"] >= QUALITY_THRESHOLD
    return {
        **state,
        "quality_passed": passed,
        "scores": scores,
        "retry_count": state.get("retry_count", 0) + (0 if passed else 1),
    }

async def full_quality_assessment(input_text: str, output_text: str) -> dict:
    dimensions = ["relevance", "accuracy", "completeness"]
    scores = {}
    for dim in dimensions:
        scores[dim] = await evaluate_quality(input_text, output_text, dim)
    scores["average"] = sum(scores.values()) / len(scores)
    return scores
```

**Correct -- batch evaluation over golden datasets:**
```python
async def batch_evaluate(model, dataset: list[dict], metrics: list[str]) -> dict:
    """Evaluate model over a golden dataset."""
    results = []
    for example in dataset:
        output = await model.generate(example["input"])
        scores = {m: await evaluate(example, output, m) for m in metrics}
        results.append({"input": example["input"], "expected": example["expected"],
                        "actual": output, "scores": scores})

    # Aggregate
    avg_scores = {m: sum(r["scores"][m] for r in results) / len(results) for m in metrics}
    return {"sample_size": len(dataset), "avg_scores": avg_scores, "results": results}
```

**Correct -- pairwise comparison for A/B evaluation:**
```python
async def pairwise_compare(input_text: str, output_a: str, output_b: str) -> str:
    """Compare two model outputs, return winner."""
    response = await judge_model.chat([{
        "role": "user",
        "content": f"""Compare these two responses to the input.
Input: {input_text[:500]}
Response A: {output_a[:1000]}
Response B: {output_b[:1000]}
Which is better? Reply with just 'A' or 'B'."""
    }])
    return response.content.strip()
```

Key principles:
- Always implement quality gates before returning LLM output to users
- Use 50+ samples for reliable batch evaluation metrics
- Pairwise comparison eliminates position bias (randomize A/B order)
- Track evaluation scores over time for regression detection
