---
title: Unit Testing Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Test Structure (unit) — CRITICAL — 3 rules

Core unit test patterns for isolated, maintainable business logic tests.

- `unit-aaa-pattern.md` — Arrange-Act-Assert structure, test isolation, observable behavior testing
- `unit-parametrized.md` — test.each/parametrize patterns, edge case coverage, descriptive names
- `unit-fixture-scoping.md` — Fixture scope selection, mutable vs expensive state, teardown cleanup

## 2. HTTP Mocking (mocking) — HIGH — 2 rules

Network mocking patterns for deterministic frontend and integration tests.

- `mocking-msw.md` — MSW 2.x http handlers, server lifecycle, per-test overrides
- `mocking-vcr.md` — VCR.py cassette recording, sensitive data filtering, CI replay mode

## 3. Test Data (data) — MEDIUM — 3 rules

Test data management with factories, fixtures, and database seeding patterns.

- `data-factories.md` — FactoryBoy/Faker patterns, SubFactory relationships, TypeScript factories
- `data-fixtures.md` — JSON fixture loading, fixture composition, shared conftest fixtures
- `data-seeding-cleanup.md` — Database seeding, autouse cleanup, CASCADE truncation
