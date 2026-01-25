---
name: llm-evaluation
description: LLM output evaluation and quality assessment. Use when implementing LLM-as-judge patterns, quality gates for AI outputs, or automated evaluation pipelines.
context: fork
agent: llm-integrator
version: 2.0.0
tags: [evaluation, llm, quality, ragas, langfuse, 2026]
author: OrchestKit
user-invocable: false
---

# LLM Evaluation

Evaluate and validate LLM outputs for quality assurance using RAGAS and LLM-as-judge patterns.

## Quick Reference

### LLM-as-Judge Pattern

```python
async def evaluate_quality(input_text: str, output_text: str, dimension: str) -> float:
    response = await llm.chat([{
        "role": "user",
        "content": f"""Evaluate for {dimension}. Score 1-10.
Input: {input_text[:500]}
Output: {output_text[:1000]}
Respond with just the number."""
    }])
    return int(response.content.strip()) / 10
```

### Quality Gate

```python
QUALITY_THRESHOLD = 0.7

async def quality_gate(state: dict) -> dict:
    scores = await full_quality_assessment(state["input"], state["output"])
    passed = scores["average"] >= QUALITY_THRESHOLD
    return {**state, "quality_passed": passed}
```

### Hallucination Detection

```python
async def detect_hallucination(context: str, output: str) -> dict:
    # Check if output contains claims not in context
    return {"has_hallucinations": bool, "unsupported_claims": []}
```

## RAGAS Metrics (2026)

| Metric | Use Case | Threshold |
|--------|----------|-----------|
| Faithfulness | RAG grounding | ≥ 0.8 |
| Answer Relevancy | Q&A systems | ≥ 0.7 |
| Context Precision | Retrieval quality | ≥ 0.7 |
| Context Recall | Retrieval completeness | ≥ 0.7 |

## Anti-Patterns (FORBIDDEN)

```python
# ❌ NEVER use same model as judge and evaluated
output = await gpt4.complete(prompt)
score = await gpt4.evaluate(output)  # Same model!

# ❌ NEVER use single dimension
if relevance_score > 0.7:  # Only checking one thing
    return "pass"

# ❌ NEVER set threshold too high
THRESHOLD = 0.95  # Blocks most content

# ✅ ALWAYS use different judge model
score = await gpt4_mini.evaluate(claude_output)

# ✅ ALWAYS use multiple dimensions
scores = await evaluate_all_dimensions(output)
if scores["average"] > 0.7:
    return "pass"
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Judge model | GPT-4o-mini or Claude Haiku |
| Threshold | 0.7 for production, 0.6 for drafts |
| Dimensions | 3-5 most relevant to use case |
| Sample size | 50+ for reliable metrics |

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/evaluation-metrics.md](references/evaluation-metrics.md) | RAGAS & LLM-as-judge metrics |
| [examples/evaluation-patterns.md](examples/evaluation-patterns.md) | Complete evaluation examples |
| [checklists/evaluation-checklist.md](checklists/evaluation-checklist.md) | Setup and review checklists |
| [scripts/evaluator-template.py](scripts/evaluator-template.py) | Starter evaluation template |

## Related Skills

- `quality-gates` - Workflow quality control
- `langfuse-observability` - Tracking evaluation scores
- `agent-loops` - Self-correcting with evaluation

## Capability Details

### llm-as-judge
**Keywords:** LLM judge, judge model, evaluation model, grader LLM
**Solves:**
- Use LLM to evaluate other LLM outputs
- Implement judge prompts for quality
- Configure evaluation criteria

### ragas-metrics
**Keywords:** RAGAS, faithfulness, answer relevancy, context precision
**Solves:**
- Evaluate RAG with RAGAS metrics
- Measure faithfulness and relevancy
- Assess context precision and recall

### hallucination-detection
**Keywords:** hallucination, factuality, grounded, verify facts
**Solves:**
- Detect hallucinations in LLM output
- Verify factual accuracy
- Implement grounding checks

### quality-gates
**Keywords:** quality gate, threshold, pass/fail, evaluation gate
**Solves:**
- Implement quality thresholds
- Block low-quality outputs
- Configure multi-metric gates

### batch-evaluation
**Keywords:** batch eval, dataset evaluation, bulk scoring, eval suite
**Solves:**
- Evaluate over golden datasets
- Run batch evaluation pipelines
- Generate evaluation reports

### pairwise-comparison
**Keywords:** pairwise, A/B comparison, side-by-side, preference
**Solves:**
- Compare two model outputs
- Implement preference ranking
- Run A/B evaluations
