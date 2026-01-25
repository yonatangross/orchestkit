# Selection Criteria

Content classification and difficulty stratification for golden datasets.

## Content Type Classification

### Supported Types

| Type | Description | Quality Focus |
|------|-------------|---------------|
| `article` | Technical articles, blog posts | Depth, accuracy, actionability |
| `tutorial` | Step-by-step guides | Completeness, clarity, code quality |
| `research_paper` | Academic papers, whitepapers | Rigor, citations, methodology |
| `documentation` | API docs, reference materials | Accuracy, completeness, examples |
| `video_transcript` | Transcribed video content | Structure, coherence, key points |
| `code_repository` | README, code analysis | Code quality, documentation |

### Classification Criteria

```python
# Content Type Decision Tree
def classify_content_type(content: str, source_url: str) -> str:
    """Classify content type based on structure and source."""

    # URL-based hints
    if "arxiv.org" in source_url or "papers" in source_url:
        return "research_paper"
    if "docs." in source_url or "/api/" in source_url:
        return "documentation"
    if "github.com" in source_url:
        return "code_repository"

    # Content-based analysis
    if has_step_by_step_structure(content):
        return "tutorial"
    if has_academic_structure(content):  # Abstract, methodology, results
        return "research_paper"

    # Default
    return "article"
```

## Difficulty Classification

### Stratification Levels

| Level | Semantic Complexity | Expected Score | Characteristics |
|-------|---------------------|----------------|-----------------|
| **trivial** | Direct keyword match | >0.85 | Technical terms, exact phrases |
| **easy** | Common synonyms | >0.70 | Well-known concepts, slight variations |
| **medium** | Paraphrased intent | >0.55 | Conceptual queries, multi-topic |
| **hard** | Multi-hop reasoning | >0.40 | Cross-domain, comparative analysis |
| **adversarial** | Edge cases | Graceful degradation | Robustness tests, off-domain |

### Classification Factors

```python
def classify_difficulty(document: dict) -> str:
    """Classify document difficulty for retrieval testing."""

    factors = {
        "technical_density": count_technical_terms(document["content"]),
        "section_count": len(document.get("sections", [])),
        "cross_references": count_cross_references(document),
        "abstraction_level": assess_abstraction(document),
        "domain_specificity": assess_domain_specificity(document),
    }

    # Scoring rubric
    score = 0
    if factors["technical_density"] > 50:
        score += 2
    if factors["section_count"] > 10:
        score += 1
    if factors["cross_references"] > 5:
        score += 2
    if factors["abstraction_level"] == "high":
        score += 2

    # Map score to difficulty
    if score <= 2:
        return "trivial"
    elif score <= 4:
        return "easy"
    elif score <= 6:
        return "medium"
    elif score <= 8:
        return "hard"
    else:
        return "adversarial"
```

## Quality Evaluation Dimensions

### 1. Accuracy (Weight: 0.25)

**What it measures:** Factual correctness, up-to-date information

**Evaluation criteria:**
- Technical claims are verifiable
- Code examples are syntactically correct
- No outdated information (check dates, versions)
- Sources/citations where applicable

**Thresholds:**
- Perfect: 0.95-1.0 (all claims verifiable)
- Acceptable: 0.70-0.94 (minor inaccuracies)
- Failing: <0.70 (significant errors)

### 2. Coherence (Weight: 0.20)

**What it measures:** Logical flow, structure, readability

**Evaluation criteria:**
- Clear introduction and conclusion
- Logical section ordering
- Smooth transitions between topics
- Consistent terminology

**Thresholds:**
- Perfect: 0.90-1.0 (professional quality)
- Acceptable: 0.60-0.89 (readable but rough)
- Failing: <0.60 (confusing structure)

### 3. Depth (Weight: 0.25)

**What it measures:** Thoroughness, detail level, comprehensiveness

**Evaluation criteria:**
- Covers topic comprehensively
- Includes edge cases and caveats
- Provides context and background
- Appropriate level of detail for audience

**Thresholds:**
- Perfect: 0.90-1.0 (exhaustive coverage)
- Acceptable: 0.55-0.89 (covers main points)
- Failing: <0.55 (superficial treatment)

### 4. Relevance (Weight: 0.30)

**What it measures:** Alignment with OrchestKit's technical domains

**Target domains:**
- AI/ML (LangGraph, RAG, agents, embeddings)
- Backend (FastAPI, PostgreSQL, APIs)
- Frontend (React, TypeScript)
- DevOps (Docker, Kubernetes, CI/CD)
- Security (OWASP, authentication)

**Thresholds:**
- Perfect: 0.95-1.0 (core domain, highly relevant)
- Acceptable: 0.70-0.94 (related domain)
- Failing: <0.70 (off-topic for OrchestKit)

## Best Practices

### Quality Thresholds

```yaml
# Recommended thresholds for golden dataset inclusion
minimum_quality_score: 0.70
minimum_confidence: 0.65
required_tags: 2  # At least 2 domain tags
required_queries: 3  # At least 3 test queries
```

### Coverage Balance

Maintain balanced coverage across:
- Content types (don't over-index on articles)
- Difficulty levels (need trivial AND hard)
- Domains (spread across AI/ML, backend, frontend, etc.)

### Duplicate Prevention

Before adding:
1. Check URL against existing `source_url_map.json`
2. Run semantic similarity against existing document embeddings
3. Warn if >80% similar to existing document

### Provenance Tracking

Always record:
- Source URL (canonical)
- Curation date
- Agent scores (for audit trail)
- Langfuse trace ID