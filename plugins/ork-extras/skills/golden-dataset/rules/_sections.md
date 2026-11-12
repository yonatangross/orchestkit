---
title: Golden Dataset Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Curation (curation) -- HIGH -- 2 rules

Content collection and multi-agent annotation for golden datasets.

- `curation-collection.md` -- Content type classification, quality thresholds, duplicate prevention
- `curation-annotation.md` -- Multi-agent pipeline, consensus aggregation, Langfuse tracing

## 2. Management (management) -- HIGH -- 2 rules

Versioning and storage for golden datasets.

- `management-versioning.md` -- JSON backup format, embedding regeneration, disaster recovery
- `management-storage.md` -- Backup strategies, URL contract, data integrity checks

## 3. Validation (validation) -- CRITICAL -- 1 rule

Regression testing for golden datasets. Difficulty ladder, coverage floors, and duplicate
thresholds moved to `../references/ork-delta.md` (2026-07-31 wrap-plus-delta thinning).

- `validation-regression.md` -- Difficulty distribution, pre-commit hooks, full dataset validation

## 4. Add Workflow (add-workflow) -- HIGH -- 1 rule

Structured workflow for adding new documents to the golden dataset with quality gates.

- `curation-add-workflow.md` -- 9-phase curation, parallel quality analysis, bias detection, silver-to-gold classification
