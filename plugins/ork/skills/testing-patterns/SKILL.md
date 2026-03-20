---
name: testing-patterns
description: "Redirect — testing-patterns was split into 5 focused sub-skills. Use when looking for testing-patterns, writing tests, or test automation. Redirects to testing-unit, testing-e2e, testing-integration, testing-llm, or testing-perf."
tags: [testing, redirect, deprecated]
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
complexity: low
effort: low
---

# Testing Patterns (Redirect)

> **This skill was split into 5 focused sub-skills in v7.2.0.** Use the appropriate sub-skill below.

## Sub-Skills

| Sub-Skill | Focus | When to Use |
|-----------|-------|-------------|
| `ork:testing-unit` | Unit tests, AAA pattern, fixtures, mocking, factories | Isolated business logic tests |
| `ork:testing-e2e` | Playwright, page objects, visual regression, a11y | Browser-based end-to-end tests |
| `ork:testing-integration` | API endpoints, database, contract testing | Cross-boundary integration tests |
| `ork:testing-llm` | LLM mocking, DeepEval/RAGAS, structured output | AI/ML evaluation and testing |
| `ork:testing-perf` | k6, Locust, pytest-xdist, benchmark | Performance and load testing |

## Quick Reference

```bash
/ork:testing-unit          # Unit testing patterns
/ork:testing-e2e           # End-to-end with Playwright
/ork:testing-integration   # API and database integration
/ork:testing-llm           # LLM evaluation patterns
/ork:testing-perf          # Performance and load testing
```

## Related Skills

- `ork:testing-unit` — Unit testing: AAA pattern, fixtures, mocking, factories
- `ork:testing-e2e` — E2E testing: Playwright, page objects, visual regression
- `ork:testing-integration` — Integration testing: API endpoints, database, contracts
- `ork:testing-llm` — LLM testing: mock responses, DeepEval/RAGAS evaluation
- `ork:testing-perf` — Performance testing: k6, Locust, pytest-xdist
