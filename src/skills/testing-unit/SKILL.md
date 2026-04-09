---
name: testing-unit
license: MIT
compatibility: "Claude Code 2.1.76+."
description: Unit testing patterns for isolated business logic tests — AAA pattern, parametrized tests (test.each, @pytest.mark.parametrize), fixture scoping (function/module/session), mocking with MSW/VCR at network level, and test data management with factories (FactoryBoy, faker-js). Use when writing unit tests, setting up mocks, structuring test data, optimizing test speed, choosing fixture scope, or reducing test boilerplate. Covers Vitest, Jest, pytest.
tags: [testing, unit, mocking, msw, vcr, fixtures, factories, vitest-4, aroundEach]
context: fork
agent: test-generator
version: 2.1.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: reference
targets:
  - library: vitest
    version: ">=4.1.0"
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
path_patterns: ["*.test.*", "*.spec.*", "**/vitest.config.*", "**/jest.config.*"]
---

# Unit Testing Patterns

Focused patterns for writing isolated, fast, maintainable unit tests. Covers test structure (AAA), parametrization, fixture management, HTTP mocking (MSW/VCR), and test data generation with factories.

Each category has individual rule files in `rules/` loaded on-demand, plus reference material, checklists, and scaffolding scripts.

## Core Principles (ALWAYS apply)

1. **AAA structure**: Every test MUST follow Arrange-Act-Assert. Use `// Arrange`, `// Act`, `// Assert` comments for clarity.
2. **Parametrize, don't duplicate**: Use `test.each` (TypeScript) or `@pytest.mark.parametrize` (Python) when testing multiple inputs. Never copy-paste the same test body with different values.
3. **Fixture scoping matters**: Use `scope="function"` (default) for mutable data. Use `scope="module"` or `scope="session"` ONLY for expensive read-only resources (DB engines, ML models). Mutable data with shared scope causes flaky tests.
4. **Speed target**: Each unit test should run under **100ms**. If it's slower, you're likely hitting I/O — mock it.
5. **Mock at the network level**: Use MSW (TypeScript) or VCR.py (Python) to intercept HTTP at the network layer. Never mock `fetch`/`axios`/`requests` directly.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Unit Test Structure](#unit-test-structure) | 3 | CRITICAL | Writing any unit test |
| [HTTP Mocking](#http-mocking) | 2 | HIGH | Mocking API calls in frontend/backend tests |
| [Test Data Management](#test-data-management) | 3 | MEDIUM | Setting up test data, factories, fixtures |

**Total: 8 rules across 3 categories, 4 references, 3 checklists, 1 example set, 3 scripts**

## Unit Test Structure

Core patterns for structuring isolated unit tests with clear phases and efficient execution.

| Rule | File | Key Pattern |
|------|------|-------------|
| AAA Pattern | `rules/unit-aaa-pattern.md` | Arrange-Act-Assert with isolation |
| Fixture Scoping | `rules/unit-fixture-scoping.md` | function/module/session scope selection |
| Parametrized Tests | `rules/unit-parametrized.md` | test.each / @pytest.mark.parametrize |

**Reference:** `references/aaa-pattern.md` — detailed AAA implementation with checklist

## HTTP Mocking

Network-level request interception for deterministic tests without hitting real APIs.

| Rule | File | Key Pattern |
|------|------|-------------|
| MSW 2.x | `rules/mocking-msw.md` | Network-level mocking for frontend (TypeScript) |
| VCR.py | `rules/mocking-vcr.md` | Record/replay HTTP cassettes (Python) |

**References:**
- `references/msw-2x-api.md` — full MSW 2.x API (handlers, GraphQL, WebSocket, passthrough)
- `references/stateful-testing.md` — Hypothesis RuleBasedStateMachine for stateful tests

**Checklists:**
- `checklists/msw-setup-checklist.md` — MSW installation, handler setup, test writing
- `checklists/vcr-checklist.md` — VCR configuration, sensitive data filtering, CI setup

**Examples:** `examples/handler-patterns.md` — CRUD, error simulation, auth flow, file upload handlers

## Test Data Management

Factories, fixtures, and seeding patterns for isolated, realistic test data.

| Rule | File | Key Pattern |
|------|------|-------------|
| Data Factories | `rules/data-factories.md` | FactoryBoy / @faker-js builders |
| Data Fixtures | `rules/data-fixtures.md` | JSON fixtures with composition |
| Seeding & Cleanup | `rules/data-seeding-cleanup.md` | Automated DB seeding and teardown |

**Reference:** `references/factory-patterns.md` — advanced factory patterns (Sequence, SubFactory, Traits)

**Checklist:** `checklists/test-data-checklist.md` — data generation, cleanup, isolation verification

## Quick Start

### TypeScript (Vitest + MSW)

```typescript
import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { calculateDiscount } from './pricing';

// 1. Pure unit test with AAA pattern
describe('calculateDiscount', () => {
  test.each([
    [100, 0],
    [150, 15],
    [200, 20],
  ])('for order $%i returns $%i discount', (total, expected) => {
    // Arrange
    const order = { total };

    // Act
    const discount = calculateDiscount(order);

    // Assert
    expect(discount).toBe(expected);
  });
});

// 2. MSW mocked API test
const server = setupServer(
  http.get('/api/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Test User' });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('fetches user from API', async () => {
  // Arrange — MSW handler set up above

  // Act
  const response = await fetch('/api/users/123');
  const data = await response.json();

  // Assert
  expect(data.name).toBe('Test User');
});
```

### Python (pytest + FactoryBoy)

```python
import pytest
from factory import Factory, Faker, SubFactory

class UserFactory(Factory):
    class Meta:
        model = dict
    email = Faker('email')
    name = Faker('name')

class TestUserService:
    @pytest.mark.parametrize("role,can_edit", [
        ("admin", True),
        ("viewer", False),
    ])
    def test_edit_permission(self, role, can_edit):
        # Arrange
        user = UserFactory(role=role)

        # Act
        result = user_can_edit(user)

        # Assert
        assert result == can_edit
```

## Vitest 4.1 Features

### aroundEach / aroundAll (preferred for DB transactions)

Wraps each test in setup/teardown — cleaner than separate `beforeEach`/`afterEach` for transactions:

```typescript
test.aroundEach(async (runTest, { db }) => {
  await db.transaction(runTest)  // auto-rollback on test end
})

test('insert user', async ({ db }) => {
  await db.insert({ name: 'Alice' })
  // transaction auto-rolls back — no cleanup needed
})
```

`aroundAll` wraps entire suites the same way.

### mockThrow / mockThrowOnce

Replaces the verbose `mockImplementation(() => { throw err })` pattern:

```typescript
const fn = vi.fn()
fn.mockThrow(new Error('connection lost'))  // always throws
fn.mockThrowOnce(new Error('timeout'))      // throws once, then normal
```

### vi.defineHelper (clean stack traces)

Custom assertion helpers that point errors to the call site, not the helper internals:

```typescript
const assertPair = vi.defineHelper((a, b) => {
  expect(a).toEqual(b)  // error points to where assertPair() was CALLED
})
```

### Test Tags

Filter tests by tags in CLI — useful for CI fast paths:

```typescript
// vitest.config.ts
test: {
  tags: {
    unit: { timeout: 5000 },
    flaky: { retry: 3 },
  }
}
```

```bash
vitest --tags-filter="unit and !flaky"
vitest --tags-filter="(unit or integration) and !slow"
```

### Agent Reporter

Minimal output (failures only) — use in AI agent / CI contexts:

```bash
AI_AGENT=copilot vitest    # auto-detect agent mode
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Test framework (TS) | Vitest 4.1+ (modern, fast, aroundEach, test tags) or Jest (mature ecosystem) |
| Test framework (Python) | pytest with plugins (parametrize, asyncio, cov) |
| HTTP mocking (TS) | MSW 2.x at network level, never mock fetch/axios directly |
| HTTP mocking (Python) | VCR.py with cassettes, filter sensitive data |
| Test data | Factories (FactoryBoy/faker-js) over hardcoded fixtures |
| Fixture scope | `scope="function"` for mutable (default). `module`/`session` ONLY for expensive immutable resources |
| Execution time | Under **100ms** per unit test — if slower, mock external calls |
| Coverage target | 90%+ business logic, 100% critical paths |

## Common Mistakes

1. **Testing implementation details** instead of public behavior (brittle tests)
2. **Mocking fetch/axios directly** instead of using MSW at network level (incomplete coverage)
3. **Shared mutable state** between tests via module-scoped fixtures (flaky tests)
4. **Hard-coded test data** with duplicate IDs (test conflicts in parallel runs)
5. **No cleanup** after database seeding (state leaks between tests)
6. **Over-mocking** — testing your mocks instead of your code (false confidence)
7. **Verbose throw mocking** — `mockImplementation(() => { throw err })` instead of `mockThrow(err)` (Vitest 4.1+)

## Scripts

| Script | File | Purpose |
|--------|------|---------|
| Create Test Case | `scripts/create-test-case.md` | Scaffold test file with auto-detected framework |
| Create Test Fixture | `scripts/create-test-fixture.md` | Scaffold pytest fixture with context detection |
| Create MSW Handler | `scripts/create-msw-handler.md` | Scaffold MSW handler for an API endpoint |
