---
title: Errors Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Diagnosis (root-cause) — CRITICAL — 1 rule

Blocks symptom suppression by requiring full root-cause tracing before any fix is applied, preventing data corruption and cascading failures.

- `root-cause-before-fix.md` — Read full stack trace, identify originating line, and trace data flow to root cause before applying any fix

## 2. Pattern Matching (accuracy) — HIGH — 1 rule

Requires full error signature matching (tool + message + context) rather than keyword matching to prevent applying wrong fix templates.

- `pattern-matching-accuracy.md` — Match on complete error signature including tool name, message, and triggering input before selecting a fix template
