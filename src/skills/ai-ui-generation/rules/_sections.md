---
title: AI UI Generation Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Prompt Engineering (ai-prompt) — HIGH — 2 rules

Structured prompt patterns for generating UI components with AI tools.

- `ai-prompt-patterns.md` — Constraint-first prompts: framework, tokens, a11y, states
- `ai-iteration-patterns.md` — Multi-pass prompt refinement for complex interactive states

## 2. Quality Assurance (ai-review, ai-ci) — CRITICAL/HIGH — 2 rules

Review checklists and CI gates for AI-generated UI components.

- `ai-review-checklist.md` — 10-point review checklist for every AI-generated component
- `ai-ci-gate.md` — Automated CI pipeline: lint, a11y, visual regression, bundle size

## 3. Design System Integration (ai-token, ai-refactoring) — HIGH — 2 rules

Ensuring AI output conforms to design tokens and system conventions.

- `ai-token-injection.md` — Pass design token names in prompts, reject hardcoded values
- `ai-refactoring-conformance.md` — Step-by-step refactoring of raw AI output for design system

## 4. Tool Selection & Workflow (ai-tool, ai-iteration) — MEDIUM — 2 rules

Choosing the right AI tool and iterating effectively.

- `ai-tool-selection.md` — When to use v0 vs Bolt vs Cursor based on task type
- `ai-iteration-patterns.md` — Iterative prompt workflows for multi-state components
