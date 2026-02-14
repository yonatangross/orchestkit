---
name: testing-patterns
license: MIT
compatibility: "Claude Code 2.1.34+."
description: Comprehensive testing patterns for unit, integration, E2E, pytest, API mocking (MSW/VCR), test data, property/contract testing, performance, LLM, and accessibility testing. Use when writing tests, setting up test infrastructure, or validating application quality.
tags: [testing, unit, integration, e2e, pytest, msw, vcr, property, contract, performance, llm, a11y]
context: fork
agent: test-generator
version: 2.0.0
author: OrchestKit
user-invocable: false
complexity: high
metadata:
  category: document-asset-creation
---

# Testing Patterns

Comprehensive patterns for building production test suites. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Unit Testing](#unit-testing) | 3 | CRITICAL | AAA pattern, parametrized tests, fixture scoping |
| [Integration Testing](#integration-testing) | 3 | HIGH | API endpoints, database tests, component integration |
| [E2E Testing](#e2e-testing) | 3 | HIGH | Playwright, AI agents, page objects |
| [Pytest Advanced](#pytest-advanced) | 3 | HIGH | Custom markers, xdist parallel, plugins |
| [API Mocking](#api-mocking) | 3 | HIGH | MSW 2.x, VCR.py, LLM API mocking |
| [Test Data](#test-data) | 3 | MEDIUM | Factories, fixtures, seeding/cleanup |
| [Verification](#verification) | 3 | MEDIUM | Property-based, stateful, contract testing |
| [Performance](#performance) | 3 | MEDIUM | k6 load tests, Locust, test types |
| [LLM Testing](#llm-testing) | 3 | HIGH | Mock responses, DeepEval, structured output |
| [Accessibility](#accessibility) | 3 | MEDIUM | jest-axe, Playwright axe, CI gates |
| [Execution](#execution) | 2 | HIGH | Parallel runs (xdist/matrix), coverage thresholds/reporting |
| [Validation](#validation) | 2 | HIGH | Zod schema testing, tRPC/Prisma end-to-end type safety |
| [Evidence](#evidence) | 1 | MEDIUM | Task completion verification, exit codes, evidence protocol |

**Total: 35 rules across 13 categories**

## Quick Start

```python
# pytest: AAA pattern with fixtures
@pytest.fixture
def user(db_session):
    return UserFactory.create(role="admin")

def test_user_can_publish(user, article):
    result = article.publish(by=user)
    assert result.status == "published"
```

```typescript
// Vitest + MSW: API integration test
const server = setupServer(
  http.get('/api/users', () => HttpResponse.json([{ id: 1 }]))
);
test('renders user list', async () => {
  render(<UserList />);
  expect(await screen.findByText('User 1')).toBeInTheDocument();
});
```

## Unit Testing

Isolated business logic tests with fast, deterministic execution.

| Rule | File | Key Pattern |
|------|------|-------------|
| AAA Pattern | `rules/unit-aaa-pattern.md` | Arrange-Act-Assert with Vitest/pytest |
| Parametrized Tests | `rules/unit-parametrized.md` | `test.each`, `@pytest.mark.parametrize`, indirect |
| Fixture Scoping | `rules/unit-fixture-scoping.md` | function/module/session scope selection |

## Integration Testing

Component interactions, API endpoints, and database integration.

| Rule | File | Key Pattern |
|------|------|-------------|
| API Testing | `rules/integration-api.md` | Supertest, httpx AsyncClient, FastAPI TestClient |
| Database Testing | `rules/integration-database.md` | In-memory SQLite, transaction rollback, test containers |
| Component Integration | `rules/integration-component.md` | React Testing Library, QueryClientProvider |

## E2E Testing

End-to-end validation with Playwright 1.58+.

| Rule | File | Key Pattern |
|------|------|-------------|
| Playwright Core | `rules/e2e-playwright.md` | Semantic locators, auto-wait, flaky detection |
| AI Agents | `rules/e2e-ai-agents.md` | Planner/Generator/Healer, init-agents |
| Page Objects | `rules/e2e-page-objects.md` | Page object model, visual regression |

## Pytest Advanced

Advanced pytest infrastructure for scalable test suites.

| Rule | File | Key Pattern |
|------|------|-------------|
| Custom Markers | `rules/pytest-markers.md` | smoke/slow/integration markers, pyproject.toml |
| Parallel Execution | `rules/pytest-xdist.md` | xdist loadscope, worker DB isolation |
| Plugins & Hooks | `rules/pytest-plugins.md` | conftest plugins, factory fixtures, async mode |

## API Mocking

Network-level mocking for deterministic tests.

| Rule | File | Key Pattern |
|------|------|-------------|
| MSW 2.x | `rules/mocking-msw.md` | http/graphql/ws handlers, server.use() override |
| VCR.py | `rules/mocking-vcr.md` | Record/replay cassettes, sensitive data filtering |
| LLM API Mocking | `rules/mocking-llm-apis.md` | Custom matchers, async VCR, CI record modes |

## Test Data

Fixture and factory patterns for test data management.

| Rule | File | Key Pattern |
|------|------|-------------|
| Factory Patterns | `rules/data-factories.md` | FactoryBoy, faker, TypeScript factories |
| JSON Fixtures | `rules/data-fixtures.md` | Fixture composition, conftest loading |
| Seeding & Cleanup | `rules/data-seeding-cleanup.md` | Database seeding, autouse cleanup, isolation |

## Verification

Advanced verification patterns beyond example-based testing.

| Rule | File | Key Pattern |
|------|------|-------------|
| Property-Based | `rules/verification-property.md` | Hypothesis strategies, roundtrip/idempotence |
| Stateful Testing | `rules/verification-stateful.md` | RuleBasedStateMachine, Schemathesis |
| Contract Testing | `rules/verification-contract.md` | Pact consumer/provider, broker CI/CD |

## Performance

Load and stress testing for capacity validation.

| Rule | File | Key Pattern |
|------|------|-------------|
| k6 Patterns | `rules/perf-k6.md` | Stages, thresholds, custom metrics |
| Locust | `rules/perf-locust.md` | HttpUser tasks, on_start auth |
| Test Types | `rules/perf-types.md` | Load/stress/spike/soak profiles |

## LLM Testing

Testing patterns for AI/LLM applications.

| Rule | File | Key Pattern |
|------|------|-------------|
| Mock Responses | `rules/llm-mocking.md` | AsyncMock, patch model_factory |
| DeepEval Quality | `rules/llm-deepeval.md` | AnswerRelevancy, Faithfulness, Hallucination |
| Structured Output | `rules/llm-structured.md` | Schema validation, timeout testing |

## Accessibility

Automated accessibility testing for WCAG compliance.

| Rule | File | Key Pattern |
|------|------|-------------|
| jest-axe | `rules/a11y-jest-axe.md` | Component-level axe validation |
| Playwright axe | `rules/a11y-playwright.md` | Page-level wcag2aa scanning |
| CI Gates | `rules/a11y-ci-gates.md` | PR blocking, regression prevention |

## Execution

Test execution strategies for parallel runs and coverage collection.

| Rule | File | Key Pattern |
|------|------|-------------|
| Parallel Execution | `rules/execution-parallel.md` | xdist, CI matrix sharding, worker DB isolation |
| Coverage Collection | `rules/execution-coverage.md` | pytest-cov, v8, thresholds, CI upload |

## Validation

Schema validation testing with Zod, tRPC, and end-to-end type safety.

| Rule | File | Key Pattern |
|------|------|-------------|
| Zod Schema | `rules/validation-zod-schema.md` | safeParse testing, branded types, assertNever |
| End-to-End Types | `rules/validation-end-to-end.md` | tRPC, Prisma, Pydantic, schema rejection tests |

## Evidence

Evidence collection for verifiable task completion.

| Rule | File | Key Pattern |
|------|------|-------------|
| Evidence Verification | `rules/verification-evidence.md` | Exit codes, test/build/quality evidence, protocol |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Unit framework | Vitest (TS), pytest (Python) |
| E2E framework | Playwright 1.58+ with semantic locators |
| API mocking | MSW 2.x (frontend), VCR.py (backend) |
| Test data | Factories over fixtures |
| Coverage targets | 90% business logic, 70% integration, 100% critical paths |
| Performance tool | k6 (JS), Locust (Python) |
| A11y testing | jest-axe + Playwright axe-core |
| Runtime validation | Zod (safeParse at boundaries) |
| E2E type safety | tRPC (no codegen) |
| Branded types | Zod .brand() for ID confusion prevention |
| Evidence minimum | Exit code 0 + timestamp |
| Coverage standard | 70% production, 80% gold |

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [scripts/](scripts/) | Templates: conftest, page objects, MSW handlers, k6 scripts |
| [checklists/](checklists/) | Pre-flight checklists for each testing category |
| [references/](references/) | API references: Playwright, MSW 2.x, DeepEval, strategies |
| [examples/](examples/) | Complete test examples and patterns |

## Related Skills

- `test-standards-enforcer` - AAA and naming enforcement
- `run-tests` - Test execution orchestration
- `golden-dataset-validation` - Golden dataset testing
- `observability-monitoring` - Metrics and monitoring
