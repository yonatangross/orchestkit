---
title: E2E Testing Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. emulate Backends (emulate) — HIGH — 1 rule

First-choice pattern for replacing flaky external APIs with deterministic emulate backends.

- `emulate-e2e.md` — emulate seed-start-Playwright-assert pattern, per-worker port isolation, CI configuration

## 2. Playwright (e2e) — HIGH — 3 rules

Core Playwright patterns for resilient end-to-end browser testing.

- `e2e-playwright.md` — Semantic locators, auto-waiting, expect assertions for dynamic content
- `e2e-page-objects.md` — Page object classes, reusable interaction methods, readable tests
- `e2e-ai-agents.md` — Playwright AI agent framework, Planner/Generator/Healer workflow

## 3. Accessibility (a11y) — MEDIUM — 2 rules

Accessibility testing patterns for WCAG compliance validation.

- `a11y-playwright.md` — axe-core/Playwright page-level audits, WCAG tag configuration, interactive state testing
- `a11y-testing.md` — CI accessibility gates, jest-axe component testing, PR blocking rules

## 4. Validation (validation) — HIGH — 1 rule

End-to-end type safety validation across API layers.

- `validation-end-to-end.md` — tRPC type inference, Zod runtime validation, boundary protection
