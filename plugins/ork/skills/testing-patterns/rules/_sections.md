---
title: Testing Patterns Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Unit Testing (unit) — CRITICAL — 3 rules

Isolated business logic tests with fast, deterministic execution.

- `unit-aaa-pattern.md` — Arrange-Act-Assert with Vitest and pytest
- `unit-parametrized.md` — test.each, @pytest.mark.parametrize, indirect parametrization
- `unit-fixture-scoping.md` — function/module/session scope selection and isolation

## 2. Integration Testing (integration) — HIGH — 3 rules

Component interactions, API endpoints, and database integration.

- `integration-api.md` — Supertest, httpx AsyncClient, FastAPI TestClient
- `integration-database.md` — In-memory SQLite, transaction rollback, test containers
- `integration-component.md` — React Testing Library with QueryClientProvider

## 3. E2E Testing (e2e) — HIGH — 3 rules

End-to-end validation with Playwright 1.58+.

- `e2e-playwright.md` — Semantic locators, auto-wait, flaky test detection
- `e2e-ai-agents.md` — Planner/Generator/Healer agents, init-agents CLI
- `e2e-page-objects.md` — Page object model, visual regression testing

## 4. Pytest Advanced (pytest) — HIGH — 2 rules

Advanced pytest infrastructure for scalable test suites.

- `pytest-execution.md` — Custom markers, pyproject.toml, pytest-xdist parallel execution, worker DB isolation
- `pytest-plugins.md` — conftest plugins, factory fixtures, async mode

## 5. API Mocking (mocking) — HIGH — 2 rules

Network-level mocking for deterministic tests.

- `mocking-msw.md` — MSW 2.x http/graphql/ws handlers, runtime overrides
- `mocking-vcr.md` — VCR.py record/replay cassettes, sensitive data filtering

## 6. Test Data (data) — MEDIUM — 3 rules

Fixture and factory patterns for test data management.

- `data-factories.md` — FactoryBoy, faker, TypeScript factory functions
- `data-fixtures.md` — JSON fixtures, fixture composition, conftest loading
- `data-seeding-cleanup.md` — Database seeding, autouse cleanup, test isolation

## 7. Verification (verification) — MEDIUM — 3 rules

Advanced verification beyond example-based testing.

- `verification-techniques.md` — Evidence verification, Hypothesis strategies, roundtrip and idempotence properties
- `verification-stateful.md` — RuleBasedStateMachine, Schemathesis API fuzzing
- `verification-contract.md` — Pact consumer/provider tests, broker CI/CD

## 8. Performance (perf) — MEDIUM — 3 rules

Load and stress testing for capacity validation.

- `perf-k6.md` — k6 stages, thresholds, custom metrics, CI integration
- `perf-locust.md` — Locust HttpUser tasks, on_start authentication
- `perf-types.md` — Load/stress/spike/soak test profiles and when to use each

## 9. LLM Testing (llm) — HIGH — 2 rules

Testing patterns for AI/LLM applications.

- `llm-mocking.md` — AsyncMock, VCR.py cassettes, custom matchers, deterministic fixtures
- `llm-evaluation.md` — DeepEval metrics, Pydantic schema validation, timeout testing

## 10. Accessibility (a11y) — MEDIUM — 2 rules

Automated accessibility testing for WCAG compliance.

- `a11y-testing.md` — CI/CD gates, jest-axe unit testing, PR blocking, component state testing
- `a11y-playwright.md` — Page-level Playwright + axe-core scanning

## 11. Execution (execution) — HIGH — 1 rule

Test execution strategies for parallel runs, coverage collection, and CI optimization.

- `execution.md` — Coverage reporting, parallel execution, pytest-cov, failure analysis

## 12. Validation (validation) — HIGH — 2 rules

Schema validation testing with Zod, tRPC, Prisma, and end-to-end type safety.

- `validation-zod-schema.md` — Zod schemas, branded types, exhaustive switches, safeParse testing
- `validation-end-to-end.md` — tRPC end-to-end types, Pydantic, Python NewType, schema rejection tests

## 13. Evidence Verification

Merged into `verification-techniques.md` (Section 7).
