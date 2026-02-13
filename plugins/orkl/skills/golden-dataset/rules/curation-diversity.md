---
title: Dataset Diversity
impact: HIGH
impactDescription: "Without balanced coverage across difficulty levels, content types, and domains, evaluation metrics become biased and miss real-world retrieval failures"
tags: diversity, difficulty, stratification, coverage, balance
---

## Dataset Diversity

Difficulty stratification, domain coverage, and balance guidelines for golden datasets.

**Difficulty Levels:**

| Level | Semantic Complexity | Expected Score | Characteristics |
|-------|---------------------|----------------|-----------------|
| **trivial** | Direct keyword match | >0.85 | Technical terms, exact phrases |
| **easy** | Common synonyms | >0.70 | Well-known concepts, slight variations |
| **medium** | Paraphrased intent | >0.55 | Conceptual queries, multi-topic |
| **hard** | Multi-hop reasoning | >0.40 | Cross-domain, comparative analysis |
| **adversarial** | Edge cases | Graceful degradation | Robustness tests, off-domain |

**Difficulty Classification:**
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

**Coverage Requirements:**

| Metric | Minimum |
|--------|---------|
| Tutorials | >= 15% of documents |
| Research papers | >= 5% of documents |
| Domain coverage | >= 5 docs per expected domain |
| Hard queries | >= 10% of queries |
| Adversarial queries | >= 5% of queries |

**Difficulty Distribution Minimums:**

| Level | Minimum Count |
|-------|---------------|
| trivial | 3 |
| easy | 3 |
| medium | 5 |
| hard | 3 |

**Coverage Gap Detection:**
```python
def analyze_coverage_gaps(
    documents: list[dict],
    queries: list[dict],
) -> dict:
    """Analyze dataset coverage and identify gaps."""

    # Content type distribution
    content_types = {}
    for doc in documents:
        ct = doc.get("content_type", "unknown")
        content_types[ct] = content_types.get(ct, 0) + 1

    # Domain/tag distribution
    all_tags = []
    for doc in documents:
        all_tags.extend(doc.get("tags", []))
    tag_counts = {}
    for tag in all_tags:
        tag_counts[tag] = tag_counts.get(tag, 0) + 1

    # Difficulty distribution
    difficulties = {}
    for query in queries:
        diff = query.get("difficulty", "unknown")
        difficulties[diff] = difficulties.get(diff, 0) + 1

    # Identify gaps
    gaps = []
    total_docs = len(documents)
    if content_types.get("tutorial", 0) / total_docs < 0.15:
        gaps.append("Under-represented: tutorials (<15%)")
    if content_types.get("research_paper", 0) / total_docs < 0.05:
        gaps.append("Under-represented: research papers (<5%)")

    expected_domains = ["ai-ml", "backend", "frontend", "devops", "security"]
    for domain in expected_domains:
        if tag_counts.get(domain, 0) < 5:
            gaps.append(f"Under-represented domain: {domain} (<5 docs)")

    total_queries = len(queries)
    if difficulties.get("hard", 0) / total_queries < 0.10:
        gaps.append("Under-represented: hard queries (<10%)")

    return {
        "content_type_distribution": content_types,
        "difficulty_distribution": difficulties,
        "gaps": gaps,
    }
```

**Key rules:**
- Maintain balanced coverage across content types, difficulty levels, and domains
- Do not over-index on articles -- ensure tutorials and research papers are represented
- Need both trivial AND hard queries for meaningful evaluation
- Run coverage analysis before and after adding new entries
- Target all 5 expected domains (ai-ml, backend, frontend, devops, security)
