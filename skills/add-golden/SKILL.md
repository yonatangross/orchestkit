---
name: add-golden
description: Curate and add documents to the golden dataset with multi-agent validation. Use when adding test data, creating golden datasets, saving examples.
context: fork
version: 1.1.0
author: OrchestKit
tags: [curation, golden-dataset, evaluation, testing]
user-invocable: true
allowedTools: [Read, Write, Edit, Grep, Glob, Task, TaskCreate, TaskUpdate]
skills: [golden-dataset-validation, llm-evaluation, test-data-management]
---

# Add to Golden Dataset

Multi-agent curation workflow for adding high-quality documents.

## Quick Start

```bash
/add-golden https://example.com/article
/add-golden https://arxiv.org/abs/2312.xxxxx
```

---

## ⚠️ CRITICAL: Task Management is MANDATORY (CC 2.1.16)

**BEFORE doing ANYTHING else, create tasks to track progress:**

```python
# 1. Create main curation task IMMEDIATELY
TaskCreate(
  subject="Add to golden dataset: {url}",
  description="Multi-agent curation workflow",
  activeForm="Curating document"
)

# 2. Create subtasks for each phase
TaskCreate(subject="Fetch and extract content", activeForm="Fetching content")
TaskCreate(subject="Run quality analysis", activeForm="Analyzing quality")
TaskCreate(subject="Validate and check duplicates", activeForm="Validating")
TaskCreate(subject="Get user approval", activeForm="Awaiting approval")
TaskCreate(subject="Write to dataset", activeForm="Writing to dataset")

# 3. Update status as you progress
TaskUpdate(taskId="2", status="in_progress")  # When starting
TaskUpdate(taskId="2", status="completed")    # When done
```

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

## Phase 3: Parallel Analysis (4 Agents)

Launch ALL 4 agents in ONE message with `run_in_background: true`:

```python
# PARALLEL - All 4 agents in ONE message
Task(
  subagent_type="code-quality-reviewer",
  prompt="""QUALITY EVALUATION for document: $ARGUMENTS

  Evaluate content quality:
  1. Accuracy of technical content
  2. Writing coherence and clarity
  3. Depth of coverage
  4. Relevance to domain

  SUMMARY: End with: "RESULT: Score [N.NN] - [INCLUDE|REVIEW|EXCLUDE]"
  """,
  run_in_background=True
)
Task(
  subagent_type="workflow-architect",
  prompt="""DIFFICULTY CLASSIFICATION for: $ARGUMENTS

  Classify retrieval difficulty:
  1. How direct are the keywords?
  2. Requires paraphrasing to find?
  3. Multi-hop reasoning needed?
  4. Edge cases or adversarial queries?

  SUMMARY: End with: "RESULT: [trivial|easy|medium|hard|adversarial]"
  """,
  run_in_background=True
)
Task(
  subagent_type="data-pipeline-engineer",
  prompt="""DOMAIN TAGGING for: $ARGUMENTS

  Identify domain tags:
  1. Primary technology domain
  2. Secondary domains
  3. Use case categories
  4. Skill level (beginner/intermediate/advanced)

  SUMMARY: End with: "RESULT: [N] tags - [primary domain]"
  """,
  run_in_background=True
)
Task(
  subagent_type="test-generator",
  prompt="""TEST QUERY GENERATION for: $ARGUMENTS

  Generate test queries:
  1. Direct keyword queries
  2. Paraphrased queries
  3. Multi-concept queries
  4. Edge case queries

  SUMMARY: End with: "RESULT: [N] queries generated - [difficulty mix]"
  """,
  run_in_background=True
)
```

### Quality Dimensions

| Dimension | Weight |
|-----------|--------|
| Accuracy | 0.25 |
| Coherence | 0.20 |
| Depth | 0.25 |
| Relevance | 0.30 |

### Difficulty Levels

- trivial: Direct keyword match (>0.85 score)
- easy: Common synonyms (>0.70 score)
- medium: Paraphrased intent (>0.55 score)
- hard: Multi-hop reasoning (>0.40 score)
- adversarial: Edge cases, robustness

## Phase 4: Validation Checks

- URL validation (no placeholders)
- Schema validation (required fields)
- Duplicate check (>80% similarity)
- Quality gates (min sections, content length)

## Phase 5: Decision Thresholds

| Score | Decision |
|-------|----------|
| >= 0.75 | INCLUDE |
| >= 0.55 | REVIEW |
| < 0.55 | EXCLUDE |

## Phase 6: User Approval

Present results for user decision:
- Approve: Add with generated queries
- Modify: Edit details before adding
- Reject: Do not add

## Phase 7: Write to Dataset

Update fixture files:
- `documents_expanded.json`
- `source_url_map.json`
- `queries.json`

Validate fixture consistency after writing.

## Summary

**Total Parallel Agents: 4**
- 1 code-quality-reviewer
- 1 workflow-architect
- 1 data-pipeline-engineer
- 1 test-generator

**Quality Gates:**
- Minimum score: 0.55 for review
- No placeholder URLs
- No duplicates (>90% similar)
- At least 2 tags, 2 sections

## Related Skills

- `golden-dataset-validation` - Validate existing golden datasets for quality and coverage
- `llm-evaluation` - LLM output evaluation patterns used in quality scoring
- `test-data-management` - General test data strategies and fixture management

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Quality Threshold | >= 0.55 for review | Balances precision with recall for dataset curation |
| Duplicate Detection | 80% similarity | Prevents near-duplicates while allowing related content |
| Parallel Agents | 4 concurrent | Optimal parallelism for quality/difficulty/tagging analysis |
| Weighting | Relevance highest (0.30) | Retrieval relevance most critical for RAG evaluation |

## References

- [Quality Scoring](references/quality-scoring.md)