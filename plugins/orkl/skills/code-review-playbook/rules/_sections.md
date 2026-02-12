---
title: Code Review Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. TypeScript Quality (typescript) — HIGH — 1 rule

TypeScript-specific review patterns: strict types, Zod validation, exhaustive checks, React 19 APIs.

- `typescript-quality.md` — Type safety, no `any`, Zod for API responses, assertNever in switches

## 2. Python Quality (python) — HIGH — 1 rule

Python-specific review patterns: Pydantic v2, ruff formatting, async safety, type hints.

- `python-quality.md` — Pydantic validators, ruff compliance, mypy strict, async timeout protection

## 3. Security Baseline (security) — CRITICAL — 1 rule

Security review baseline that applies to all languages: OWASP Top 10, secrets, authentication.

- `security-baseline.md` — No hardcoded secrets, auth on all endpoints, input validation, dependency audit
