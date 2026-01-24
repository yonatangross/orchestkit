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

## CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main curation task IMMEDIATELY
TaskCreate(
  subject="Add to golden dataset: {url}",
  description="Multi-agent curation with quality explanation",
  activeForm="Curating document"
)

# 2. Create subtasks for each phase (9-phase process)
TaskCreate(subject="Fetch and extract content", activeForm="Fetching content")
TaskCreate(subject="Run quality analysis", activeForm="Analyzing quality")
TaskCreate(subject="Explain quality scores", activeForm="Explaining scores")
TaskCreate(subject="Check for bias", activeForm="Detecting bias")
TaskCreate(subject="Check dataset diversity", activeForm="Checking diversity")
TaskCreate(subject="Validate and check duplicates", activeForm="Validating")
TaskCreate(subject="Get user approval", activeForm="Awaiting approval")
TaskCreate(subject="Write to dataset", activeForm="Writing to dataset")
TaskCreate(subject="Update version tracking", activeForm="Updating version")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
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
| **7. Validation** | Schema, duplicates, quality gates | Validation status |
| **8. Silver-to-Gold Workflow** | Promote or mark as silver | Classification |
| **9. Version Tracking** | Track changes, enable rollback | Version entry |

---

## Phase 1: Input Collection

Get URL and detect content type:
- article (blog post, tech article)
- tutorial (step-by-step guide)
- documentation (API docs, reference)
- research_paper (academic, whitepaper)

## Phase 2: Fetch and Extract

Extract document structure:
- Title and sections
- Code blocks
- Key technical terms
- Metadata (author, date)

---

## Phase 3: Parallel Quality Analysis (4 Agents)

Launch ALL 4 agents in ONE message with `run_in_background: true`:

```python
# PARALLEL - All 4 agents in ONE message
Task(
  subagent_type="code-quality-reviewer",
  prompt="""QUALITY EVALUATION for document: $ARGUMENTS

  Evaluate content quality with DETAILED SCORING:

  1. ACCURACY (0.0-1.0)
     Score: [0.0-1.0]
     Evidence:
     - [specific accurate/inaccurate claims]
     - [verified/unverified code snippets]
     - [currency of information]

  2. COHERENCE (0.0-1.0)
     Score: [0.0-1.0]
     Evidence:
     - [logical flow assessment]
     - [transition quality]
     - [terminology consistency]

  3. DEPTH (0.0-1.0)
     Score: [0.0-1.0]
     Evidence:
     - [topic coverage assessment]
     - [edge cases addressed]
     - [caveats included]

  4. RELEVANCE (0.0-1.0)
     Score: [0.0-1.0]
     Evidence:
     - [alignment with OrchestKit domains]
     - [practical applicability]
     - [target audience fit]

  Output JSON:
  {
    "scores": {
      "accuracy": N.NN,
      "coherence": N.NN,
      "depth": N.NN,
      "relevance": N.NN
    },
    "evidence": {
      "accuracy": ["evidence1", "evidence2"],
      "coherence": ["evidence1", "evidence2"],
      "depth": ["evidence1", "evidence2"],
      "relevance": ["evidence1", "evidence2"]
    },
    "composite": N.NN
  }

  SUMMARY: End with: "QUALITY: [N.NN] - [INCLUDE|REVIEW|EXCLUDE] - [key strength/weakness]"
  """,
  run_in_background=True
)

Task(
  subagent_type="workflow-architect",
  prompt="""DIFFICULTY CLASSIFICATION for: $ARGUMENTS

  Classify retrieval difficulty with EXPLANATION:

  Difficulty factors:
  1. KEYWORD DIRECTNESS: How direct are the keywords?
     - Score: [0.0-1.0] (1.0 = very direct)
     - Evidence: [specific examples]

  2. PARAPHRASE REQUIREMENT: Needs paraphrasing to find?
     - Score: [0.0-1.0] (1.0 = no paraphrasing needed)
     - Evidence: [specific examples]

  3. REASONING DEPTH: Multi-hop reasoning needed?
     - Score: [0.0-1.0] (1.0 = single-hop only)
     - Evidence: [reasoning chain analysis]

  4. EDGE CASE COVERAGE: Adversarial queries handled?
     - Score: [0.0-1.0] (1.0 = handles edge cases)
     - Evidence: [edge case examples]

  Classification:
  - trivial (composite > 0.85): Direct keyword match
  - easy (composite > 0.70): Common synonyms
  - medium (composite > 0.55): Paraphrased intent
  - hard (composite > 0.40): Multi-hop reasoning
  - adversarial: Edge cases, robustness tests

  SUMMARY: End with: "DIFFICULTY: [level] (score: [N.NN]) - [key factor]"
  """,
  run_in_background=True
)

Task(
  subagent_type="data-pipeline-engineer",
  prompt="""DOMAIN TAGGING for: $ARGUMENTS

  Identify domain tags with CONFIDENCE:

  1. PRIMARY DOMAIN
     - Domain: [domain name]
     - Confidence: [0-100]%
     - Evidence: [why this domain]

  2. SECONDARY DOMAINS
     - Domain 1: [name] ([confidence]%)
     - Domain 2: [name] ([confidence]%)

  3. USE CASE CATEGORIES
     - Categories: [list]
     - Evidence: [practical applications mentioned]

  4. SKILL LEVEL
     - Level: [beginner/intermediate/advanced]
     - Evidence: [prerequisites assumed]

  SUMMARY: End with: "TAGS: [primary] + [N] secondary - [skill level]"
  """,
  run_in_background=True
)

Task(
  subagent_type="test-generator",
  prompt="""TEST QUERY GENERATION for: $ARGUMENTS

  Generate test queries with EXPECTED ANSWERS:

  1. DIRECT QUERIES (3-5)
     Query: [query]
     Expected: [what should be retrieved]
     Difficulty: trivial/easy

  2. PARAPHRASED QUERIES (3-5)
     Query: [query using synonyms]
     Expected: [what should be retrieved]
     Difficulty: easy/medium

  3. MULTI-CONCEPT QUERIES (2-3)
     Query: [combines multiple concepts]
     Expected: [reasoning chain]
     Difficulty: medium/hard

  4. EDGE CASE QUERIES (2-3)
     Query: [adversarial or tricky]
     Expected: [should still find or gracefully fail]
     Difficulty: hard/adversarial

  SUMMARY: End with: "QUERIES: [N] total - [easy/medium/hard mix]"
  """,
  run_in_background=True
)
```

---

## Phase 4: Quality Score Explanation (NEW)

**Goal:** Explain WHY each dimension received its score.

### Score Explanation Template

```markdown
## Quality Score Explanation

### Overall Score: [N.NN]/1.0 ([INCLUDE|REVIEW|EXCLUDE])

### Accuracy: [N.NN]/1.0
**Why this score:**
- [Specific reason 1 with evidence]
- [Specific reason 2 with evidence]

**What would improve it:**
- [Specific improvement 1]
- [Specific improvement 2]

### Coherence: [N.NN]/1.0
**Why this score:**
- [Specific reason with evidence]

**What would improve it:**
- [Specific improvement]

### Depth: [N.NN]/1.0
**Why this score:**
- [Specific reason with evidence]

**What would improve it:**
- [Specific improvement]

### Relevance: [N.NN]/1.0
**Why this score:**
- [Specific reason with evidence]

**What would improve it:**
- [Specific improvement]
```

### Explanation Quality Checks

| Check | Requirement |
|-------|-------------|
| Specificity | Each explanation cites specific content |
| Actionability | Improvement suggestions are concrete |
| Consistency | Explanations match scores (low score = issues cited) |
| Evidence | Claims backed by quotes/examples |

---

## Phase 5: Bias Detection Agent (NEW)

**Goal:** Detect potential bias in content before adding to dataset.

```python
Task(
  subagent_type="workflow-architect",
  prompt="""BIAS DETECTION for: $ARGUMENTS

  Check for various types of bias:

  1. TECHNOLOGY BIAS
     - Favors specific tools/frameworks unfairly?
     - Missing alternatives that should be mentioned?
     - Evidence: [specific examples]

  2. RECENCY BIAS
     - Only covers latest version, ignores LTS?
     - Dismisses "old" approaches without justification?
     - Evidence: [specific examples]

  3. COMPLEXITY BIAS
     - Assumes advanced knowledge without stating?
     - Over-simplifies complex topics?
     - Evidence: [specific examples]

  4. VENDOR BIAS
     - Promotes specific vendor products?
     - Missing open-source alternatives?
     - Evidence: [specific examples]

  5. GEOGRAPHIC/CULTURAL BIAS
     - Assumes US/Western context?
     - Missing internationalization considerations?
     - Evidence: [specific examples]

  Output JSON:
  {
    "bias_detected": true/false,
    "bias_types": [
      {"type": "...", "severity": "low/medium/high", "evidence": "..."}
    ],
    "mitigation_suggestions": ["..."],
    "overall_bias_score": 0-10 (0=no bias, 10=severe bias)
  }

  SUMMARY: End with: "BIAS: [score]/10 - [N] issues found - [most significant]"
  """,
  run_in_background=True
)
```

### Bias Response Actions

| Bias Score | Action |
|------------|--------|
| 0-2 | Proceed normally |
| 3-5 | Add bias disclaimer to document |
| 6-8 | Require user review of bias concerns |
| 9-10 | Recommend against inclusion or major edits |

---

## Phase 6: Diversity Dashboard (NEW)

**Goal:** Ensure golden dataset maintains balance across dimensions.

### Diversity Metrics

```python
# Check existing dataset composition
def check_diversity(new_document, existing_dataset):
    metrics = {
        "domain_distribution": count_by_domain(existing_dataset),
        "difficulty_distribution": count_by_difficulty(existing_dataset),
        "content_type_distribution": count_by_type(existing_dataset),
        "date_distribution": count_by_date(existing_dataset),
        "source_distribution": count_by_source(existing_dataset)
    }

    # Check if new document improves or worsens diversity
    impact = assess_diversity_impact(new_document, metrics)
    return impact
```

### Diversity Dashboard Template

```markdown
## Dataset Diversity Dashboard

### Current Composition (Before Adding)

| Domain | Count | Percentage | Target |
|--------|-------|------------|--------|
| AI/ML | N | X% | 25% |
| Backend | N | X% | 20% |
| Frontend | N | X% | 20% |
| DevOps | N | X% | 15% |
| Security | N | X% | 10% |
| Other | N | X% | 10% |

### Difficulty Distribution

| Difficulty | Count | Percentage | Target |
|------------|-------|------------|--------|
| Trivial | N | X% | 10% |
| Easy | N | X% | 25% |
| Medium | N | X% | 35% |
| Hard | N | X% | 20% |
| Adversarial | N | X% | 10% |

### Impact of Adding This Document

- **Domain:** [adds to underrepresented / adds to overrepresented]
- **Difficulty:** [improves balance / worsens balance]
- **Diversity Score Change:** [+X% / -X%]

### Recommendation

[IMPROVES DIVERSITY | NEUTRAL | CONSIDER ALTERNATIVES]
```

---

## Phase 7: Validation Checks

Standard validation:
- URL validation (no placeholders)
- Schema validation (required fields)
- Duplicate check (>80% similarity)
- Quality gates (min sections, content length)

---

## Phase 8: Silver-to-Gold Workflow (NEW)

**Goal:** Implement two-tier system where documents can be "silver" (promising but needs work) before becoming "gold" (verified high-quality).

### Classification Criteria

| Status | Criteria | Actions |
|--------|----------|---------|
| **GOLD** | Score >= 0.75, no bias issues, verified | Add to main dataset |
| **SILVER** | Score 0.55-0.74, minor issues | Add to silver dataset, track for promotion |
| **REJECT** | Score < 0.55, major issues | Do not add, provide feedback |

### Silver-to-Gold Promotion

```python
# Silver document promotion workflow
def check_promotion_eligibility(silver_doc):
    criteria = {
        "time_in_silver": days_since_added >= 7,  # Minimum aging
        "quality_reassessment": reassess_quality() >= 0.75,
        "bias_check_passed": bias_score <= 2,
        "community_feedback": no_negative_feedback,
        "usage_metrics": retrieval_success_rate >= 80%
    }

    if all(criteria.values()):
        return "PROMOTE_TO_GOLD"
    elif any_critical_failure(criteria):
        return "DEMOTE_TO_REJECT"
    else:
        return "KEEP_IN_SILVER"
```

### Silver Dataset Structure

```json
{
  "silver_documents": [
    {
      "id": "silver-001",
      "url": "...",
      "added_date": "2026-01-20",
      "quality_score": 0.68,
      "issues": ["low coherence", "missing examples"],
      "improvement_suggestions": ["..."],
      "promotion_target_date": "2026-01-27",
      "reassessment_count": 0
    }
  ]
}
```

---

## Phase 9: Version Tracking + Rolling Updates (NEW)

**Goal:** Track all changes to the golden dataset with ability to rollback.

### Version Entry Structure

```json
{
  "version": "1.2.3",
  "timestamp": "2026-01-24T12:00:00Z",
  "change_type": "ADD|UPDATE|REMOVE|PROMOTE|DEMOTE",
  "document_id": "doc-123",
  "url": "https://...",
  "change_summary": "Added new RAG tutorial",
  "quality_score": 0.82,
  "previous_version": "1.2.2",
  "rollback_available": true,
  "changed_by": "Claude Code session xyz"
}
```

### Version Operations

```python
# Add to golden dataset with version tracking
def add_with_versioning(document, dataset):
    # Get current version
    current_version = get_current_version(dataset)

    # Increment version
    new_version = increment_version(current_version, "patch")

    # Create version entry
    version_entry = {
        "version": new_version,
        "timestamp": now(),
        "change_type": "ADD",
        "document_id": generate_id(),
        "quality_score": document.quality_score,
        # ... other fields
    }

    # Add to version history
    append_version_history(version_entry)

    # Add document to dataset
    add_document(document, dataset)

    return new_version

# Rollback to previous version
def rollback(target_version, dataset):
    # Find all changes since target version
    changes_to_revert = get_changes_since(target_version)

    # Revert in reverse order
    for change in reversed(changes_to_revert):
        revert_change(change, dataset)

    # Create rollback version entry
    create_rollback_entry(target_version)
```

### Rolling Update Policy

| Update Type | Version Bump | Approval Required |
|-------------|--------------|-------------------|
| Add document | Patch (0.0.X) | No |
| Update document | Patch (0.0.X) | No |
| Remove document | Minor (0.X.0) | Yes |
| Schema change | Major (X.0.0) | Yes |
| Rollback | Patch (0.0.X) | Yes |

---

## Quality Scoring Reference

### Dimension Weights

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Accuracy | 0.25 | Technical correctness, valid code, current info |
| Coherence | 0.20 | Logical structure, clear transitions |
| Depth | 0.25 | Comprehensive coverage, edge cases |
| Relevance | 0.30 | Alignment with OrchestKit domains |

### Scoring Formula

```python
quality_score = (
    accuracy * 0.25 +
    coherence * 0.20 +
    depth * 0.25 +
    relevance * 0.30
)
```

### Decision Thresholds

| Score Range | Decision | Action |
|-------------|----------|--------|
| >= 0.75 | GOLD | Add to main dataset |
| 0.55 - 0.74 | SILVER | Add to silver dataset |
| < 0.55 | REJECT | Do not add |

---

## Summary

**Total Parallel Agents: 5**
- 4 quality/tagging agents (Phase 3)
- 1 bias detection agent (Phase 5)

**New Features (v2.0.0):**
- Quality Score Explanation (WHY each score)
- Bias Detection Agent
- Diversity Dashboard
- Silver-to-Gold Workflow
- Version Tracking + Rolling Updates

---

**Version:** 2.0.0 (January 2026)

**v2.0.0 Enhancements:**
- Added **Quality Score Explanation**: Detailed reasoning for each dimension score
- Added **Bias Detection Agent**: Check for technology, recency, complexity, vendor bias
- Added **Diversity Dashboard**: Track and balance dataset composition
- Added **Silver-to-Gold Workflow**: Two-tier system for document maturation
- Added **Version Tracking**: Full history with rollback capability
- Expanded from 7-phase to 9-phase process

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Score explanation | Required for all dimensions | Transparency, actionable feedback |
| Bias detection | Dedicated agent | Prevent dataset contamination |
| Two-tier system | Silver + Gold | Allow promising docs time to mature |
| Version tracking | Semantic versioning | Clear change history, safe rollbacks |
| Diversity metrics | 5 dimensions | Ensure balanced, representative dataset |

## Related Skills

- `golden-dataset-validation` - Validate existing golden datasets for quality and coverage
- `llm-evaluation` - LLM output evaluation patterns used in quality scoring
- `test-data-management` - General test data strategies and fixture management

## References

- [Quality Scoring](references/quality-scoring.md)
