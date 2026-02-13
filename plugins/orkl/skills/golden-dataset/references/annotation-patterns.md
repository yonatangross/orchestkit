# Annotation Patterns

Multi-agent analysis pipeline and consensus aggregation for golden dataset curation.

## Multi-Agent Analysis Pipeline

### Architecture

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
|       |            |           |         |     |
+-------+------------+-----------+---------+-----+
        |            |           |         |
        +------------+-----------+---------+
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
+--------+---------+
         |
         v
OUTPUT: Curated document entry
```

## Agent Specifications

### Quality Evaluator Agent

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

### Difficulty Classifier Agent

```python
Task(
    subagent_type="workflow-architect",
    prompt="""DIFFICULTY CLASSIFICATION

    Analyze document complexity for retrieval testing:

    Content: {content_preview}
    Sections: {section_titles}

    Assess these factors:
    1. Technical term density (count specialized terms)
    2. Section complexity (nesting depth, count)
    3. Cross-domain references (links between topics)
    4. Abstraction level (concrete vs conceptual)
    5. Query ambiguity potential (how many ways to ask about this?)

    Output JSON:
    {
        "difficulty": "trivial|easy|medium|hard|adversarial",
        "factors": {
            "technical_density": "low|medium|high",
            "structure_complexity": "simple|moderate|complex",
            "cross_references": "none|some|many",
            "abstraction": "concrete|mixed|abstract"
        },
        "expected_retrieval_score": 0.X,
        "rationale": "..."
    }
    """
)
```

### Domain Tagger Agent

```python
Task(
    subagent_type="data-pipeline-engineer",
    prompt="""DOMAIN TAGGING

    Extract domain tags for this content:

    Content: {content_preview}
    Source: {source_url}

    Primary domains (pick 1-2):
    - ai-ml (LLM, agents, RAG, embeddings, LangGraph)
    - backend (FastAPI, PostgreSQL, APIs, microservices)
    - frontend (React, TypeScript, UI/UX)
    - devops (Docker, K8s, CI/CD, infrastructure)
    - security (auth, OWASP, encryption)
    - databases (SQL, NoSQL, vector DBs)
    - testing (pytest, playwright, TDD)

    Secondary tags (pick 3-5):
    - Specific technologies mentioned
    - Patterns/concepts covered
    - Use cases addressed

    Output JSON:
    {
        "primary_domains": ["ai-ml", "backend"],
        "tags": ["langraph", "agents", "tool-use", "fastapi"],
        "confidence": 0.X
    }
    """
)
```

### Query Generator Agent

```python
Task(
    subagent_type="test-generator",
    prompt="""TEST QUERY GENERATION

    Generate test queries for this golden dataset document:

    Document ID: {document_id}
    Title: {title}
    Sections: {section_titles}
    Content preview: {content_preview}

    Generate 3-5 test queries with varied difficulty:

    1. At least 1 TRIVIAL query (exact keyword match)
    2. At least 1 EASY query (synonyms, common terms)
    3. At least 1 MEDIUM query (paraphrased intent)
    4. Optional: 1 HARD query (cross-section reasoning)

    For each query specify:
    - Query text
    - Expected sections to match
    - Difficulty level
    - Minimum expected score

    Output JSON:
    {
        "queries": [
            {
                "id": "q-{doc-id}-{num}",
                "query": "How to implement X with Y?",
                "difficulty": "medium",
                "expected_chunks": ["section-id-1", "section-id-2"],
                "min_score": 0.55,
                "modes": ["semantic", "hybrid"],
                "category": "specific",
                "description": "Tests retrieval of X implementation details"
            }
        ]
    }
    """
)
```

## Consensus Aggregation

### Aggregation Logic

```python
from dataclasses import dataclass
from typing import Literal

@dataclass
class CurationConsensus:
    """Aggregated result from multi-agent analysis."""

    quality_score: float  # Weighted average (0-1)
    confidence: float     # Agent agreement (0-1)
    decision: Literal["include", "review", "exclude"]

    # Individual scores
    accuracy: float
    coherence: float
    depth: float
    relevance: float

    # Classification results
    content_type: str
    difficulty: str
    tags: list[str]

    # Generated queries
    suggested_queries: list[dict]

    # Warnings
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

    # Collect warnings
    warnings = []
    if q["accuracy"]["score"] < 0.6:
        warnings.append("Low accuracy score - verify technical claims")
    if q["relevance"]["score"] < 0.7:
        warnings.append("Low relevance - may be off-topic for OrchestKit")
    if domain_result["confidence"] < 0.7:
        warnings.append("Low confidence in domain classification")

    return CurationConsensus(
        quality_score=quality_score,
        confidence=confidence,
        decision=decision,
        accuracy=q["accuracy"]["score"],
        coherence=q["coherence"]["score"],
        depth=q["depth"]["score"],
        relevance=q["relevance"]["score"],
        content_type=difficulty_result.get("content_type", "article"),
        difficulty=difficulty_result["difficulty"],
        tags=domain_result["tags"],
        suggested_queries=query_result["queries"],
        warnings=warnings,
    )
```

## Langfuse Integration

### Trace Structure

```python
# Langfuse trace for curation workflow
trace = langfuse.trace(
    name="golden-dataset-curation",
    metadata={
        "source_url": url,
        "document_id": doc_id,
    }
)

# Spans for each agent
with trace.span(name="fetch_content") as span:
    content = fetch_url(url)
    span.update(output={"length": len(content)})

with trace.span(name="quality_evaluation") as span:
    quality_result = await run_quality_agent(content)
    span.update(output=quality_result)
    # Log individual dimension scores
    trace.score(name="accuracy", value=quality_result["accuracy"]["score"])
    trace.score(name="coherence", value=quality_result["coherence"]["score"])
    trace.score(name="depth", value=quality_result["depth"]["score"])
    trace.score(name="relevance", value=quality_result["relevance"]["score"])

# Final aggregated score
trace.score(name="quality_total", value=consensus.quality_score)
trace.event(
    name="curation_decision",
    metadata={"decision": consensus.decision}
)
```

### Prompt Management

All curation prompts are managed in Langfuse:

| Prompt Name | Purpose | Tags |
|-------------|---------|------|
| `golden-content-classifier` | Classify content_type | `golden-dataset`, `classification` |
| `golden-difficulty-classifier` | Assign difficulty | `golden-dataset`, `difficulty` |
| `golden-domain-tagger` | Extract tags | `golden-dataset`, `tagging` |
| `golden-query-generator` | Generate queries | `golden-dataset`, `query-gen` |