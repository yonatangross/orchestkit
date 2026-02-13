---
title: LLM Evaluation Metrics
impact: HIGH
impactDescription: "Without proper evaluation metrics, LLM quality regressions go undetected until production failures"
tags: evaluation, llm-as-judge, ragas, faithfulness, hallucination
---

## LLM Evaluation Metrics

**Incorrect -- single-dimension evaluation:**
```python
# Only checking one thing with same model as judge
output = await gpt4.complete(prompt)
score = await gpt4.evaluate(output)  # Same model as judge!
if score > 0.95:  # Threshold too high, blocks most content
    return "pass"
```

**Correct -- multi-dimension LLM-as-judge with different judge model:**
```python
async def evaluate_quality(input_text: str, output_text: str, dimension: str) -> float:
    """Use a DIFFERENT model as judge."""
    response = await judge_model.chat([{
        "role": "user",
        "content": f"""Evaluate for {dimension}. Score 1-10.
Input: {input_text[:500]}
Output: {output_text[:1000]}
Respond with just the number."""
    }])
    return int(response.content.strip()) / 10

# Evaluate across 3-5 dimensions
dimensions = ["relevance", "accuracy", "completeness", "coherence"]
scores = {d: await evaluate_quality(input_text, output, d) for d in dimensions}
average = sum(scores.values()) / len(scores)
passed = average >= 0.7  # 0.7 for production, 0.6 for drafts
```

**Correct -- RAGAS metrics for RAG evaluation:**

| Metric | Use Case | Threshold |
|--------|----------|-----------|
| Faithfulness | RAG grounding | >= 0.8 |
| Answer Relevancy | Q&A systems | >= 0.7 |
| Context Precision | Retrieval quality | >= 0.7 |
| Context Recall | Retrieval completeness | >= 0.7 |

**Correct -- hallucination detection:**
```python
async def detect_hallucination(context: str, output: str) -> dict:
    """Check if output contains claims not supported by context."""
    response = await judge_model.chat([{
        "role": "user",
        "content": f"""Check if the output contains claims not in the context.
Context: {context[:2000]}
Output: {output[:1000]}
List any unsupported claims."""
    }])
    return {"has_hallucinations": bool(unsupported), "unsupported_claims": unsupported}
```

Key decisions:
- Judge model: GPT-5.2-mini or Claude Haiku 4.5 (different from evaluated model)
- Quality threshold: 0.7 production, 0.6 drafts
- Dimensions: 3-5 most relevant to use case
- Sample size: 50+ for reliable metrics
