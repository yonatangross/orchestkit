---
title: Golden Dataset Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Curation (curation) -- HIGH -- 3 rules

Content collection, multi-agent annotation, and diversity analysis for golden datasets.

- `curation-collection.md` -- Content type classification, quality thresholds, duplicate prevention
- `curation-annotation.md` -- Multi-agent pipeline, consensus aggregation, Langfuse tracing
- `curation-diversity.md` -- Difficulty stratification, domain coverage, balance guidelines

## 2. Management (management) -- HIGH -- 3 rules

Versioning, storage, and CI/CD automation for golden datasets.

- `management-versioning.md` -- JSON backup format, embedding regeneration, disaster recovery
- `management-storage.md` -- Backup strategies, URL contract, data integrity checks
- `management-ci.md` -- GitHub Actions automation, pre-deployment validation, weekly backups

## 3. Validation (validation) -- CRITICAL -- 3 rules

Quality scoring, drift detection, and regression testing for golden datasets.

- `validation-quality.md` -- Schema validation, content quality, referential integrity
- `validation-drift.md` -- Duplicate detection, semantic similarity, coverage gap analysis
- `validation-regression.md` -- Difficulty distribution, pre-commit hooks, full dataset validation

## 4. Add Workflow (add-workflow) -- HIGH -- 1 rule

Structured workflow for adding new documents to the golden dataset with quality gates.

- `curation-add-workflow.md` -- 9-phase curation, parallel quality analysis, bias detection, silver-to-gold classification
