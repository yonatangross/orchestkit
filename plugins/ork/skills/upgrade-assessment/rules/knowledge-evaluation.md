---
title: Platform Upgrade Evaluation
impact: HIGH
impactDescription: "Upgrading without structured evaluation causes production breakage — missed breaking changes surface as runtime errors"
tags: upgrade, evaluation, scoring, readiness, dimensions, assessment
---

## Platform Upgrade Evaluation

Score upgrade readiness 0-10 across 6 weighted dimensions. Produces a composite score that determines go/no-go.

### Scoring Dimensions

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| Model Compatibility | 0.25 | Hardcoded model refs, capability assumptions, output limits |
| Hook Compatibility | 0.20 | Hook type changes, async patterns, lifecycle changes |
| Skill Coverage | 0.15 | Skill format changes, deprecated skills, new requirements |
| Agent Readiness | 0.15 | Agent format changes, model field validity, tool availability |
| Memory Architecture | 0.10 | Memory tier changes, storage format, migration needs |
| CI/CD Pipeline | 0.15 | Test compatibility, build system, deployment config |

### Score Interpretation

| Range | Label | Action |
|-------|-------|--------|
| 9-10 | Ready | Upgrade with confidence |
| 7-8 | Low Risk | Minor adjustments needed |
| 5-6 | Moderate Risk | Plan a migration sprint |
| 3-4 | High Risk | Significant rework needed |
| 1-2 | Critical Risk | Consider phased migration |
| 0 | Blocked | Cannot upgrade without fundamental changes |

### Severity Classification

| Level | Criteria | Required Action |
|-------|----------|-----------------|
| CRITICAL | Functionality breaks on upgrade | Must fix before upgrade |
| WARNING | Degraded behavior, works incorrectly | Fix in same sprint |
| INFO | Documentation outdated, no functional impact | Update when convenient |

### Priority Assignment

```
dimension_score <= 2:  priority = P0 (Blocker)    — Before upgrade
dimension_score <= 4:  priority = P1 (Critical)   — Same sprint
dimension_score <= 6:  priority = P2 (Important)  — Next sprint
dimension_score <= 8:  priority = P3 (Nice-to-Have) — Backlog
dimension_score > 8:   No action needed
```

### Key Rules

- Score **every dimension** even if it seems fine — assumptions hide breaking changes
- CRITICAL findings are **blockers** — do not upgrade until resolved
- Weighted composite score determines **overall readiness**
- P0 items must be addressed **before** starting the upgrade
- Re-score after addressing findings to **verify improvement**

**Incorrect — Upgrading without evaluation causes production breakage:**
```bash
# Just upgrade without assessment
npm install @anthropic-ai/claude@latest
git commit -m "upgrade claude"
# Production breaks: hardcoded model IDs, hook changes, context limits
```

**Correct — Structured evaluation identifies blockers before upgrade:**
```bash
# Phase 1: Detect environment
./detect-environment.sh
# Phase 2: Score dimensions (finds 3 CRITICAL issues)
./score-compatibility.sh
# Phase 3: Fix P0 blockers BEFORE upgrade
./fix-model-refs.sh && ./migrate-hooks.sh
# Then upgrade safely
```
