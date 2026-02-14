---
name: golden-dataset
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Golden dataset lifecycle patterns for curation, versioning, quality validation, and CI integration. Use when building evaluation datasets, managing dataset versions, validating quality scores, or integrating golden tests into pipelines.
tags: [golden-dataset, evaluation, dataset-curation, dataset-validation, quality, llm-testing]
context: fork
agent: data-pipeline-engineer
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: medium
metadata:
  category: document-asset-creation
---

# Golden Dataset

Comprehensive patterns for building, managing, and validating golden datasets for AI/ML evaluation. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
| -------- | ----- | ------ | ----------- |
| [Curation](#curation) | 3 | HIGH | Content collection, annotation pipelines, diversity analysis |
| [Management](#management) | 3 | HIGH | Versioning, backup/restore, CI/CD automation |
| [Validation](#validation) | 3 | CRITICAL | Quality scoring, drift detection, regression testing |
| [Add Workflow](#add-workflow) | 1 | HIGH | 9-phase curation, quality scoring, bias detection, silver-to-gold |

Total: 10 rules across 4 categories

## Curation

Content collection, multi-agent annotation, and diversity analysis for golden datasets.

| Rule | File | Key Pattern |
| ---- | ---- | ----------- |
| Collection | `rules/curation-collection.md` | Content type classification, quality thresholds, duplicate prevention |
| Annotation | `rules/curation-annotation.md` | Multi-agent pipeline, consensus aggregation, Langfuse tracing |
| Diversity | `rules/curation-diversity.md` | Difficulty stratification, domain coverage, balance guidelines |

## Management

Versioning, storage, and CI/CD automation for golden datasets.

| Rule | File | Key Pattern |
| ---- | ---- | ----------- |
| Versioning | `rules/management-versioning.md` | JSON backup format, embedding regeneration, disaster recovery |
| Storage | `rules/management-storage.md` | Backup strategies, URL contract, data integrity checks |
| CI Integration | `rules/management-ci.md` | GitHub Actions automation, pre-deployment validation, weekly backups |

## Validation

Quality scoring, drift detection, and regression testing for golden datasets.

| Rule | File | Key Pattern |
| ---- | ---- | ----------- |
| Quality | `rules/validation-quality.md` | Schema validation, content quality, referential integrity |
| Drift | `rules/validation-drift.md` | Duplicate detection, semantic similarity, coverage gap analysis |
| Regression | `rules/validation-regression.md` | Difficulty distribution, pre-commit hooks, full dataset validation |

## Add Workflow

Structured workflow for adding new documents to the golden dataset.

| Rule | File | Key Pattern |
| ---- | ---- | ----------- |
| Add Document | `rules/curation-add-workflow.md` | 9-phase curation, parallel quality analysis, bias detection |

## Quick Start Example

```python
from app.shared.services.embeddings import embed_text

async def validate_before_add(document: dict, source_url_map: dict) -> dict:
    """Pre-addition validation for golden dataset entries."""
    errors = []

    # 1. URL contract check
    if "placeholder" in document.get("source_url", ""):
        errors.append("URL must be canonical, not a placeholder")

    # 2. Content quality
    if len(document.get("title", "")) < 10:
        errors.append("Title too short (min 10 chars)")

    # 3. Tag requirements
    if len(document.get("tags", [])) < 2:
        errors.append("At least 2 domain tags required")

    return {"valid": len(errors) == 0, "errors": errors}
```

## Key Decisions

| Decision | Recommendation |
| -------- | -------------- |
| Backup format | JSON (version controlled, portable) |
| Embedding storage | Exclude from backup (regenerate on restore) |
| Quality threshold | >= 0.70 quality score for inclusion |
| Confidence threshold | >= 0.65 for auto-include |
| Duplicate threshold | >= 0.90 similarity blocks, >= 0.85 warns |
| Min tags per entry | 2 domain tags |
| Min test queries | 3 per document |
| Difficulty balance | Trivial 3, Easy 3, Medium 5, Hard 3 minimum |
| CI frequency | Weekly automated backup (Sunday 2am UTC) |

## Common Mistakes

1. Using placeholder URLs instead of canonical source URLs
2. Skipping embedding regeneration after restore
3. Not validating referential integrity between documents and queries
4. Over-indexing on articles (neglecting tutorials, research papers)
5. Missing difficulty distribution balance in test queries
6. Not running verification after backup/restore operations
7. Testing restore procedures in production instead of staging
8. Committing SQL dumps instead of JSON (not version-control friendly)

## Evaluations

See `test-cases.json` for 9 test cases across all categories.

## Related Skills

- `rag-retrieval` - Retrieval evaluation using golden dataset
- `langfuse-observability` - Tracing patterns for curation workflows
- `testing-patterns` - General testing patterns and strategies
- `ai-native-development` - Embedding generation for restore

## Capability Details

### curation

**Keywords:** golden dataset, curation, content collection, annotation, quality criteria

**Solves:**

- Classify document content types for golden dataset
- Run multi-agent quality analysis pipelines
- Generate test queries for new documents

### management

**Keywords:** golden dataset, backup, restore, versioning, disaster recovery

**Solves:**

- Backup and restore golden datasets with JSON
- Regenerate embeddings after restore
- Automate backups with CI/CD

### validation

**Keywords:** golden dataset, validation, schema, duplicate detection, quality metrics

**Solves:**

- Validate entries against document schema
- Detect duplicate or near-duplicate entries
- Analyze dataset coverage and distribution gaps
