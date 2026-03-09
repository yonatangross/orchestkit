---
name: testing-unit
license: MIT
compatibility: "Claude Code 2.1.59+."
description: Unit testing patterns for isolated business logic tests — AAA pattern, parametrized tests, fixture scoping, mocking with MSW/VCR, and test data management with factories and fixtures. Use when writing unit tests, setting up mocks, or managing test data.
tags: [testing, unit, mocking, msw, vcr, fixtures, factories]
context: fork
agent: test-generator
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# Unit Testing Patterns

Focused patterns for writing isolated, fast, maintainable unit tests. Covers test structure (AAA), parametrization, fixture management, HTTP mocking (MSW/VCR), and test data generation with factories.

Each category has individual rule files in `rules/` loaded on-demand, plus reference material, checklists, and scaffolding scripts.

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

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Test framework (TS) | Vitest (modern, fast) or Jest (mature ecosystem) |
| Test framework (Python) | pytest with plugins (parametrize, asyncio, cov) |
| HTTP mocking (TS) | MSW 2.x at network level, never mock fetch/axios directly |
| HTTP mocking (Python) | VCR.py with cassettes, filter sensitive data |
| Test data | Factories (FactoryBoy/faker-js) over hardcoded fixtures |
| Fixture scope | function (default), module/session for expensive read-only resources |
| Execution time | Under 100ms per unit test |
| Coverage target | 90%+ business logic, 100% critical paths |

## Common Mistakes

1. **Testing implementation details** instead of public behavior (brittle tests)
2. **Mocking fetch/axios directly** instead of using MSW at network level (incomplete coverage)
3. **Shared mutable state** between tests via module-scoped fixtures (flaky tests)
4. **Hard-coded test data** with duplicate IDs (test conflicts in parallel runs)
5. **No cleanup** after database seeding (state leaks between tests)
6. **Over-mocking** — testing your mocks instead of your code (false confidence)

## Scripts

| Script | File | Purpose |
|--------|------|---------|
| Create Test Case | `scripts/create-test-case.md` | Scaffold test file with auto-detected framework |
| Create Test Fixture | `scripts/create-test-fixture.md` | Scaffold pytest fixture with context detection |
| Create MSW Handler | `scripts/create-msw-handler.md` | Scaffold MSW handler for an API endpoint |
