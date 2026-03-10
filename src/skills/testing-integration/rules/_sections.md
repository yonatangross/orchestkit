---
title: Integration Testing Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. API & Component Integration (integration) — HIGH — 3 rules

Integration testing patterns for API endpoints, components, and databases.

- `integration-api.md` — supertest/httpx HTTP tests, success and error responses, status and body validation
- `integration-component.md` — React component tests with providers, userEvent interactions, DOM assertions
- `integration-database.md` — Database isolation, in-memory SQLite/test containers, transaction rollback

## 2. Contract & Property Testing (verification) — MEDIUM — 3 rules

Advanced verification patterns for cross-service contracts and invariant testing.

- `verification-contract.md` — Pact consumer/provider tests, Like/EachLike matchers, provider states
- `verification-stateful.md` — Hypothesis RuleBasedStateMachine, state transitions, invariant checks
- `verification-techniques.md` — Property-based testing with Hypothesis, roundtrip assertions, evidence verification

## 3. Schema Validation (validation) — HIGH — 1 rule

Runtime schema validation for API boundary protection.

- `validation-zod-schema.md` — Zod safeParse, branded types, boundary validation, exhaustive checking
