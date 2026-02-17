---
title: Content Collection
impact: HIGH
impactDescription: "Without systematic collection criteria, golden datasets become inconsistent in quality, leading to unreliable evaluation metrics"
tags: content-type, classification, quality-thresholds, duplicate-prevention, curation
---

## Content Collection

Systematic patterns for collecting and classifying content for golden dataset inclusion.

**Content Type Classification:**

| Type | Description | Quality Focus |
|------|-------------|---------------|
| `article` | Technical articles, blog posts | Depth, accuracy, actionability |
| `tutorial` | Step-by-step guides | Completeness, clarity, code quality |
| `research_paper` | Academic papers, whitepapers | Rigor, citations, methodology |
| `documentation` | API docs, reference materials | Accuracy, completeness, examples |
| `video_transcript` | Transcribed video content | Structure, coherence, key points |
| `code_repository` | README, code analysis | Code quality, documentation |

**Classification Decision Tree:**
```python
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

**Quality Thresholds:**
```yaml
# Recommended thresholds for golden dataset inclusion
minimum_quality_score: 0.70
minimum_confidence: 0.65
required_tags: 2          # At least 2 domain tags
required_queries: 3       # At least 3 test queries
```

**Quality Dimensions:**

| Dimension | Weight | Perfect | Acceptable | Failing |
|-----------|--------|---------|------------|---------|
| **Accuracy** | 0.25 | 0.95-1.0 | 0.70-0.94 | <0.70 |
| **Coherence** | 0.20 | 0.90-1.0 | 0.60-0.89 | <0.60 |
| **Depth** | 0.25 | 0.90-1.0 | 0.55-0.89 | <0.55 |
| **Relevance** | 0.30 | 0.95-1.0 | 0.70-0.94 | <0.70 |

**Decision Thresholds:**

| Quality Score | Confidence | Decision |
|---------------|------------|----------|
| >= 0.75 | >= 0.70 | **include** |
| >= 0.55 | any | **review** |
| < 0.55 | any | **exclude** |

**Duplicate Prevention Checklist:**
1. Check URL against existing `source_url_map.json`
2. Run semantic similarity against existing document embeddings
3. Warn if >80% similar to existing document

**Provenance Tracking -- always record:**
- Source URL (canonical)
- Curation date
- Agent scores (for audit trail)
- Langfuse trace ID

**Incorrect — Placeholder URL:**
```python
# Missing real source URL
analysis = Analysis(
    url="https://orchestkit.dev/placeholder/123",
    content_type="article",
)
```

**Correct — Real canonical URL:**
```python
# Real source for re-fetching and validation
analysis = Analysis(
    url="https://docs.python.org/3/library/asyncio.html",
    content_type="documentation",
)
```

**Key rules:**
- Never use placeholder URLs -- always store real canonical source URLs
- Require minimum 2 domain tags and 3 test queries per entry
- Score all 4 quality dimensions before inclusion decision
- Track provenance for full audit trail
