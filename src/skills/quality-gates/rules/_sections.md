---
title: Quality Gates Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Complexity Scoring (complexity) — CRITICAL — 1 rule

Assess task complexity on a 1-5 scale with blocking thresholds and escalation protocols.

- `complexity-scoring.md` — Level 1-5 characteristics, assessment formula, blocking thresholds

## 2. Gate Workflows (workflows) — HIGH — 1 rule

Pre-task validation, stuck detection, and escalation workflows.

- `workflows.md` — Gate validation, stuck detection, requirements completeness

## 3. Gate Patterns (patterns) — HIGH — 1 rule

Gate validation templates and integration patterns.

- `gate-patterns.md` — Validation templates, context integration, common pitfalls

## 4. LLM Quality Validation (llm) — HIGH — 1 rule

LLM-as-judge patterns for automated quality assessment.

- `llm-quality-validation.md` — Aspect scoring, fail-open/closed strategies, graceful degradation

## 5. Best Practices (practices) — HIGH — 2 rules

Personal pattern library for tracking success/failure patterns and code standards across projects.

- `practices-code-standards.md` — Pattern library management, success/failure tracking, confidence scoring
- `practices-review-checklist.md` — Category-based review, proactive anti-pattern detection, memory integration
