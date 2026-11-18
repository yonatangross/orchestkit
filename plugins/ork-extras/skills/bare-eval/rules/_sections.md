---
title: Bare Eval Rules
impact: high
impactDescription: Prevent eval pipeline failures and ensure --bare is used correctly
tags: [eval, bare, ci]
---

# Bare Eval Rules

## Categories

### 1. Flag Safety (High Impact)
- [bare-plugin-conflict](bare-plugin-conflict.md) — Never combine `--bare` with `--plugin-dir`

### 2. Auth Requirements (High Impact)
- [bare-requires-api-key](bare-requires-api-key.md) — Always check `ANTHROPIC_API_KEY` before using `--bare`

### 3. Pipeline Hygiene (Medium Impact)
- [bare-grading-only](bare-grading-only.md) — Use `--bare` for grading/classification, never for plugin-routed tests
