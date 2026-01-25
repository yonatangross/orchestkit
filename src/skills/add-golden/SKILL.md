---
name: add-golden
description: Curate and add documents to the golden dataset with multi-agent validation. Use when adding test data, creating golden datasets, saving examples.
context: fork
version: 2.0.0
author: OrchestKit
tags: [curation, golden-dataset, evaluation, testing, quality-scoring, bias-detection]
user-invocable: true
allowedTools: [Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate, mcp__memory__search_nodes]
skills: [golden-dataset-validation, llm-evaluation, test-data-management]
---

# Add to Golden Dataset

Multi-agent curation workflow with quality score explanations, bias detection, and version tracking.

## Quick Start

```bash
/add-golden https://example.com/article
/add-golden https://arxiv.org/abs/2312.xxxxx
```

---

## Task Management (CC 2.1.16)

```python
# Create main curation task
TaskCreate(
  subject="Add to golden dataset: {url}",
  description="Multi-agent curation with quality explanation",
  activeForm="Curating document"
)

# Create subtasks for 9-phase process
phases = ["Fetch content", "Run quality analysis", "Explain scores",
          "Check bias", "Check diversity", "Validate", "Get approval",
          "Write to dataset", "Update version"]
for phase in phases:
    TaskCreate(subject=phase, activeForm=f"{phase}ing")
```

---

## Workflow Overview

| Phase | Activities | Output |
|-------|------------|--------|
| **1. Input Collection** | Get URL, detect content type | Document metadata |
| **2. Fetch and Extract** | Parse document structure | Structured content |
| **3. Quality Analysis** | 4 parallel agents evaluate | Raw scores |
| **4. Quality Explanation** | Explain WHY each score | Score rationale |
| **5. Bias Detection** | Check for bias in content | Bias report |
| **6. Diversity Check** | Assess dataset balance | Diversity metrics |
| **7. Validation** | Schema, duplicates, gates | Validation status |
| **8. Silver-to-Gold** | Promote or mark as silver | Classification |
| **9. Version Tracking** | Track changes, rollback | Version entry |

---

## Phase 1-2: Input and Extraction

Detect content type: article, tutorial, documentation, research_paper.

Extract: title, sections, code blocks, key terms, metadata (author, date).

---

## Phase 3: Parallel Quality Analysis (4 Agents)

Launch ALL agents in ONE message with `run_in_background=True`.

| Agent | Focus | Output |
|-------|-------|--------|
| code-quality-reviewer | Accuracy, coherence, depth, relevance | Quality scores |
| workflow-architect | Keyword directness, paraphrase, reasoning | Difficulty level |
| data-pipeline-engineer | Primary/secondary domains, skill level | Tags |
| test-generator | Direct, paraphrased, multi-hop queries | Test queries |

See [Quality Scoring](references/quality-scoring.md) for detailed criteria.

---

## Phase 4: Quality Explanation

Each dimension gets WHY explanation:

```markdown
### Accuracy: [N.NN]/1.0
**Why this score:**
- [Specific reason with evidence]
**What would improve it:**
- [Specific improvement]
```

---

## Phase 5: Bias Detection

See [Bias Detection Guide](references/bias-detection-guide.md) for patterns.

Check for:
- Technology bias (favors specific tools)
- Recency bias (ignores LTS versions)
- Complexity bias (assumed knowledge)
- Vendor bias (promotes products)
- Geographic/cultural bias

| Bias Score | Action |
|------------|--------|
| 0-2 | Proceed normally |
| 3-5 | Add disclaimer |
| 6-8 | Require user review |
| 9-10 | Recommend against |

---

## Phase 6: Diversity Dashboard

Track dataset balance across:
- Domain distribution (AI/ML, Backend, Frontend, DevOps, Security)
- Difficulty distribution (trivial, easy, medium, hard, adversarial)

**Impact assessment:** Does new document improve or worsen diversity?

---

## Phase 7: Validation

- URL validation (no placeholders)
- Schema validation (required fields)
- Duplicate check (>80% similarity)
- Quality gates (min sections, content length)

---

## Phase 8: Silver-to-Gold Workflow

See [Silver-Gold Promotion](references/silver-gold-promotion.md) for criteria.

| Status | Criteria | Action |
|--------|----------|--------|
| **GOLD** | Score >= 0.75, no bias | Add to main dataset |
| **SILVER** | Score 0.55-0.74 | Add to silver, track |
| **REJECT** | Score < 0.55 | Do not add |

**Promotion criteria:** 7+ days in silver, quality >= 0.75, no negative feedback.

---

## Phase 9: Version Tracking

```json
{
  "version": "1.2.3",
  "change_type": "ADD|UPDATE|REMOVE|PROMOTE",
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

---

## Quality Scoring

| Dimension | Weight |
|-----------|--------|
| Accuracy | 0.25 |
| Coherence | 0.20 |
| Depth | 0.25 |
| Relevance | 0.30 |

**Formula:** `quality_score = accuracy*0.25 + coherence*0.20 + depth*0.25 + relevance*0.30`

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Score explanation | Required | Transparency, actionable feedback |
| Bias detection | Dedicated agent | Prevent dataset contamination |
| Two-tier system | Silver + Gold | Allow docs time to mature |
| Version tracking | Semantic versioning | Clear history, safe rollbacks |

---

## Related Skills

- `golden-dataset-validation` - Validate existing datasets
- `llm-evaluation` - LLM output evaluation patterns
- `test-data-management` - Test data strategies

---

**Version:** 2.0.0 (January 2026)
