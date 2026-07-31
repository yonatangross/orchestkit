---
name: golden-dataset
license: MIT
compatibility: "Claude Code 2.1.220+."
description: Golden dataset lifecycle patterns for curation, versioning, quality validation, and CI integration. Use when building evaluation datasets, managing dataset versions, validating quality scores, or integrating golden tests into pipelines.
tags: [golden-dataset, evaluation, dataset-curation, dataset-validation, quality, llm-testing]
context: fork
agent: data-pipeline-engineer
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: medium
persuasion-type: guidance
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Golden Dataset

Comprehensive patterns for building, managing, and validating golden datasets for AI/ML evaluation. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
| -------- | ----- | ------ | ----------- |
| [Curation](#curation) | 2 | HIGH | Content collection, annotation pipelines |
| [Management](#management) | 2 | HIGH | Versioning, backup/restore |
| [Validation](#validation) | 1 | CRITICAL | Regression testing |
| [Add Workflow](#add-workflow) | 1 | HIGH | 9-phase curation, quality scoring, bias detection, silver-to-gold |

Total: 6 rules across 4 categories. House thresholds and scars: `references/ork-delta.md`.

## Curation

Content collection, multi-agent annotation, and diversity analysis for golden datasets.

| Rule | File | Key Pattern |
| ---- | ---- | ----------- |
| Collection | `rules/curation-collection.md` | Content type classification, quality thresholds, duplicate prevention |
| Annotation | `rules/curation-annotation.md` | Multi-agent pipeline, consensus aggregation, Langfuse tracing |

Difficulty ladder, coverage floors, and duplicate thresholds: `references/ork-delta.md`.

## Management

Versioning, storage, and CI/CD automation for golden datasets.

| Rule | File | Key Pattern |
| ---- | ---- | ----------- |
| Versioning | `rules/management-versioning.md` | JSON backup format, embedding regeneration, disaster recovery |
| Storage | `rules/management-storage.md` | Backup strategies, URL contract, data integrity checks |

CI automation for backups is upstream's job; see "Upstream coverage" below.

## Validation

Quality scoring, drift detection, and regression testing for golden datasets.

| Rule | File | Key Pattern |
| ---- | ---- | ----------- |
| Regression | `rules/validation-regression.md` | Difficulty distribution, pre-commit hooks, full dataset validation |

Schema validation and duplicate detection are upstream's job (see "Upstream coverage"
below); the house thresholds they must enforce live in `references/ork-delta.md`.

## Add Workflow

Structured workflow for adding new documents to the golden dataset.

| Rule | File | Key Pattern |
| ---- | ---- | ----------- |
| Add Document | `rules/curation-add-workflow.md` | 9-phase curation, parallel quality analysis, bias detection |

## Quick Start Example

```python
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

## Running a dataset as an experiment

Curating a dataset is half the job; the other half is running something against it and scoring the
result. Both Langfuse SDKs ship a runner, and their shapes differ.

**Python (SDK 4.x):** see `monitoring-observability/references/experiments-api.md`.

**JS/TS (SDK 5.x):** `@langfuse/client` exposes the runner directly on a fetched dataset.

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();
const dataset = await langfuse.dataset.get("my-evaluation-dataset");

const result = await dataset.runExperiment({
  name: "Retrieval quality",
  task: myTask,               // (params) => Promise<any>
  evaluators: [myEvaluator],  // per-item: (params) => Promise<Evaluation | Evaluation[]>
});
```

| Type | Scores | Use for |
|---|---|---|
| `Evaluator` | one item | Per-example quality (faithfulness, relevance) |
| `RunEvaluator` | the whole run | Aggregate assertions — pass rate, mean score, regression checks |
| `Evaluation` | — | `{ name, value, comment?, metadata?, dataType?, configId? }` |

A per-item `Evaluator` cannot see the other items, so anything comparative belongs in a
`RunEvaluator`. `createEvaluatorFromAutoevals` wraps an autoevals scorer instead of hand-writing
one, and `RegressionError` is thrown when a run regresses against a configured baseline — catch it
to fail CI on a quality drop rather than only on an exception.

Full JS surface: `monitoring-observability/references/langfuse-js-v5.md`.

## Evaluations

See `test-cases.json` for 9 test cases across all categories.

## Upstream coverage (do not restate)

| Topic | First-party source |
| ----- | ------------------ |
| Dataset schema validation (JSON Schema, field constraints) | https://json-schema.org and https://zod.dev |
| Duplicate detection via embeddings, cosine similarity | https://github.com/pgvector/pgvector |
| Scheduled backup automation (cron workflows, commit bots) | https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#schedule |
| Dataset runs, experiment scoring, annotation queues | https://langfuse.com/docs/datasets |
| Backup and restore mechanics for postgres datasets | https://www.postgresql.org/docs/current/backup.html |

House thresholds these must enforce: `references/ork-delta.md`.

## Related Skills

- `ork:rag-retrieval` - Retrieval evaluation using golden dataset
- `ork:monitoring-observability` - Langfuse tracing patterns for curation workflows
- `ork:testing-llm` - Evaluation harnesses that consume golden datasets
- `ork:testing-unit` - Unit testing patterns and strategies

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
