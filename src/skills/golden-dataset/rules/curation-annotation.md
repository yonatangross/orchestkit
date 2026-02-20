---
title: Use multi-agent annotation for consistent and thorough curation quality decisions
impact: HIGH
impactDescription: "Without structured multi-agent analysis, curation decisions lack consistency and miss quality dimensions that single-pass review cannot catch"
tags: multi-agent, annotation, consensus, langfuse, pipeline
---

## Multi-Agent Annotation

Multi-agent analysis pipeline with consensus aggregation for golden dataset curation.

**Pipeline Architecture:**
```
INPUT: URL/Content
        |
        v
+------------------+
|   FETCH AGENT    |  WebFetch or file read
|   (sequential)   |  Extract structure, detect type
+--------+---------+
         |
         v
+-----------------------------------------------+
|  PARALLEL ANALYSIS AGENTS                      |
|  +----------+ +----------+ +--------+ +------+ |
|  | Quality  | |Difficulty| | Domain | |Query | |
|  |Evaluator | |Classifier| | Tagger | |Gen   | |
|  +----+-----+ +----+-----+ +---+----+ +--+---+ |
+-------+------------+-----------+---------+-----+
                     |
                     v
+-----------------------------------------------+
|  CONSENSUS AGGREGATOR                          |
|  - Weighted quality score                      |
|  - Confidence level (agent agreement)          |
|  - Final recommendation: include/review/exclude|
+--------+--------------------------------------+
         |
         v
+------------------+
|  USER APPROVAL   |  Show scores, get confirmation
+------------------+
```

**Quality Evaluator Agent:**
```python
Task(
    subagent_type="code-quality-reviewer",
    prompt="""GOLDEN DATASET QUALITY EVALUATION

    Evaluate this content for golden dataset inclusion:

    Content: {content_preview}
    Source: {source_url}
    Type: {content_type}

    Score these dimensions (0.0-1.0):

    1. ACCURACY (weight 0.25)
       - Technical correctness
       - Code validity
       - Up-to-date information

    2. COHERENCE (weight 0.20)
       - Logical structure
       - Clear flow
       - Consistent terminology

    3. DEPTH (weight 0.25)
       - Comprehensive coverage
       - Edge cases mentioned
       - Appropriate detail level

    4. RELEVANCE (weight 0.30)
       - Alignment with AI/ML, backend, frontend, DevOps
       - Practical applicability
       - Technical value

    Output JSON:
    {
        "accuracy": {"score": 0.X, "rationale": "..."},
        "coherence": {"score": 0.X, "rationale": "..."},
        "depth": {"score": 0.X, "rationale": "..."},
        "relevance": {"score": 0.X, "rationale": "..."},
        "weighted_total": 0.X,
        "recommendation": "include|review|exclude"
    }
    """,
    run_in_background=True
)
```

**Consensus Aggregation Logic:**
```python
from dataclasses import dataclass
from typing import Literal

@dataclass
class CurationConsensus:
    """Aggregated result from multi-agent analysis."""
    quality_score: float  # Weighted average (0-1)
    confidence: float     # Agent agreement (0-1)
    decision: Literal["include", "review", "exclude"]
    content_type: str
    difficulty: str
    tags: list[str]
    suggested_queries: list[dict]
    warnings: list[str]

def aggregate_results(
    quality_result: dict,
    difficulty_result: dict,
    domain_result: dict,
    query_result: dict,
) -> CurationConsensus:
    """Aggregate multi-agent results into consensus."""

    # Calculate weighted quality score
    q = quality_result
    quality_score = (
        q["accuracy"]["score"] * 0.25 +
        q["coherence"]["score"] * 0.20 +
        q["depth"]["score"] * 0.25 +
        q["relevance"]["score"] * 0.30
    )

    # Calculate confidence (variance-based)
    scores = [
        q["accuracy"]["score"],
        q["coherence"]["score"],
        q["depth"]["score"],
        q["relevance"]["score"],
    ]
    variance = sum((s - quality_score)**2 for s in scores) / len(scores)
    confidence = 1.0 - min(variance * 4, 1.0)

    # Decision thresholds
    if quality_score >= 0.75 and confidence >= 0.7:
        decision = "include"
    elif quality_score >= 0.55:
        decision = "review"
    else:
        decision = "exclude"

    return CurationConsensus(
        quality_score=quality_score,
        confidence=confidence,
        decision=decision,
        content_type=difficulty_result.get("content_type", "article"),
        difficulty=difficulty_result["difficulty"],
        tags=domain_result["tags"],
        suggested_queries=query_result["queries"],
        warnings=[],
    )
```

**Langfuse Integration:**
```python
trace = langfuse.trace(
    name="golden-dataset-curation",
    metadata={"source_url": url, "document_id": doc_id}
)

# Log individual dimension scores
trace.score(name="accuracy", value=0.85)
trace.score(name="coherence", value=0.90)
trace.score(name="depth", value=0.78)
trace.score(name="relevance", value=0.92)

# Final aggregated score
trace.score(name="quality_total", value=0.87)
trace.event(name="curation_decision", metadata={"decision": "include"})
```

**Incorrect — Sequential agent execution:**
```python
# Sequential - 4x slower
quality_result = await analyze_quality(content)
difficulty_result = await analyze_difficulty(content)
domain_result = await analyze_domain(content)
query_result = await generate_queries(content)
```

**Correct — Parallel agent execution:**
```python
# Parallel - all agents run concurrently
quality_task = Task(subagent_type="code-quality-reviewer", prompt=quality_prompt, run_in_background=True)
difficulty_task = Task(subagent_type="classifier", prompt=difficulty_prompt, run_in_background=True)
domain_task = Task(subagent_type="tagger", prompt=domain_prompt, run_in_background=True)
query_task = Task(subagent_type="query-generator", prompt=query_prompt, run_in_background=True)

# Wait for all results
results = await gather_task_results([quality_task, difficulty_task, domain_task, query_task])
```

**Key rules:**
- Run all 4 analysis agents in parallel for throughput
- Use weighted scoring (accuracy 0.25, coherence 0.20, depth 0.25, relevance 0.30)
- Require user approval before final inclusion
- Log all scores to Langfuse for audit trail
