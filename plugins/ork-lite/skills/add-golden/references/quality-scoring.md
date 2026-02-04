# Quality Scoring Reference

## Dimension Weights

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Accuracy | 0.25 | Technical correctness, valid code, current info |
| Coherence | 0.20 | Logical structure, clear transitions |
| Depth | 0.25 | Comprehensive coverage, edge cases |
| Relevance | 0.30 | Alignment with OrchestKit domains |

## Scoring Formula

```python
quality_score = (
    accuracy * 0.25 +
    coherence * 0.20 +
    depth * 0.25 +
    relevance * 0.30
)
```

## Decision Thresholds

| Score Range | Decision | Action |
|-------------|----------|--------|
| >= 0.75 | INCLUDE | Auto-add (pending user approval) |
| 0.55 - 0.74 | REVIEW | Present for manual review |
| < 0.55 | EXCLUDE | Reject with explanation |

## Quality Rubrics

### Accuracy (0.25)

| Score | Criteria |
|-------|----------|
| 0.9-1.0 | All claims verified, code tested, up-to-date |
| 0.7-0.89 | Minor inaccuracies, mostly correct |
| 0.5-0.69 | Some outdated info, code untested |
| < 0.5 | Significant errors, deprecated content |

### Coherence (0.20)

| Score | Criteria |
|-------|----------|
| 0.9-1.0 | Excellent flow, clear structure |
| 0.7-0.89 | Good organization, minor gaps |
| 0.5-0.69 | Some jumps, inconsistent terms |
| < 0.5 | Disorganized, confusing |

### Depth (0.25)

| Score | Criteria |
|-------|----------|
| 0.9-1.0 | Comprehensive, edge cases, caveats |
| 0.7-0.89 | Good coverage, some gaps |
| 0.5-0.69 | Surface level, missing details |
| < 0.5 | Superficial, incomplete |

### Relevance (0.30)

| Score | Criteria |
|-------|----------|
| 0.9-1.0 | Core OrchestKit domain, high value |
| 0.7-0.89 | Related domain, useful |
| 0.5-0.69 | Tangentially related |
| < 0.5 | Not relevant to target domains |

## Target Domains

- AI/ML (LLM, agents, RAG, embeddings, LangGraph)
- Backend (FastAPI, PostgreSQL, APIs)
- Frontend (React, TypeScript, UI/UX)
- DevOps (Docker, K8s, CI/CD)
- Security (auth, OWASP)
- Databases (SQL, NoSQL, vector DBs)
- Testing (pytest, playwright)

## Difficulty Classification

| Level | Expected Score | Characteristics |
|-------|---------------|-----------------|
| trivial | >0.85 | Exact keyword match |
| easy | >0.70 | Common synonyms |
| medium | >0.55 | Paraphrased intent |
| hard | >0.40 | Multi-hop reasoning |
| adversarial | Variable | Edge cases, robustness |