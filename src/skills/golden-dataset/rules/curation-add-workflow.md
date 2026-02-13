---
title: Add to Golden Dataset Workflow
impact: HIGH
impactDescription: "Adding documents without the full curation pipeline produces low-quality entries that degrade evaluation accuracy"
tags: golden-dataset, curation, add-golden, workflow, quality-scoring, bias-detection
---

## Add to Golden Dataset Workflow

Multi-agent curation pipeline with quality scoring, bias detection, and silver-to-gold promotion.

**Incorrect — adding documents without validation:**
```python
# No quality check, no bias detection, no dedup
dataset.append({"url": url, "content": content})
```

**Correct — 9-phase curation workflow:**

**Phase 1-2: Input and extraction**
```python
# Detect content type and extract structure
content_type = classify(url)  # article, tutorial, documentation, research_paper
structured = extract(url)      # title, sections, code blocks, key terms, metadata
```

**Phase 3: Parallel quality analysis (4 agents)**
```python
# Launch ALL quality agents in parallel
# Agent 1: Accuracy, coherence, depth, relevance scores
# Agent 2: Keyword directness, difficulty level
# Agent 3: Domain tags, skill level classification
# Agent 4: Test query generation (direct, paraphrased, multi-hop)
```

**Phase 4: Quality scoring formula**
```python
quality_score = (
    accuracy * 0.25 +
    coherence * 0.20 +
    depth * 0.25 +
    relevance * 0.30
)
```

**Phase 5-6: Bias detection and diversity check**

| Bias Score | Action |
|------------|--------|
| 0-2 | Proceed normally |
| 3-5 | Add disclaimer |
| 6-8 | Require user review |
| 9-10 | Recommend against inclusion |

**Phase 7-8: Validation and classification**

| Status | Quality Score | Action |
|--------|--------------|--------|
| GOLD | >= 0.75 | Add to main dataset |
| SILVER | 0.55-0.74 | Add to silver tier, track |
| REJECT | < 0.55 | Do not add |

**Promotion criteria:** 7+ days in silver, quality >= 0.75, no negative feedback.

**Phase 9: Version tracking**
```json
{
  "version": "1.2.3",
  "change_type": "ADD",
  "document_id": "doc-123",
  "quality_score": 0.82,
  "rollback_available": true
}
```

| Update Type | Version Bump |
|-------------|--------------|
| Add/Update document | Patch (0.0.X) |
| Remove document | Minor (0.X.0) |
| Schema change | Major (X.0.0) |

**Key rules:**
- Never skip the quality analysis phase — it prevents low-quality entries from degrading evaluations
- Run bias detection on every addition — dataset contamination is hard to reverse
- Use the two-tier system (silver/gold) to let borderline documents prove themselves
- Always validate URL is canonical (not a placeholder) and check for >80% duplicate similarity
- Minimum requirements: 2+ domain tags, 3+ test queries per document
