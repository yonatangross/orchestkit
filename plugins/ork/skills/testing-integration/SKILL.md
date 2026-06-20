---
name: testing-integration
license: MIT
compatibility: "Claude Code 2.1.183+."
description: Integration and contract testing patterns — API endpoint tests, component integration, database testing, Pact contract verification, property-based testing, and Zod schema validation. Use when testing API boundaries, verifying contracts, or validating cross-service integration.
tags: [testing, integration, contract, pact, property, zod, api]
context: fork
agent: test-generator
version: 2.1.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: reference
targets:
  - library: "@pact-foundation/pact"
    version: ">=16.0.0"
  - library: "testcontainers"
    version: ">=11.0.0"
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
path_patterns: ["**/integration/**", "**/testcontainers/**", "docker-compose.test.*"]
---

# Integration & Contract Testing

Focused patterns for testing API boundaries, cross-service contracts, component integration, database layers, property-based verification, and schema validation.

## Quick Reference

> For complex emulate setups (full config generation, webhook HMAC, CI per-worker port isolation), delegate to the [`emulate-engineer`](../../agents/emulate-engineer.md) subagent. Pairs with the `emulate-seed` skill.

| Area | Rule / Reference | Impact |
|------|-----------------|--------|
| **Stateful API testing (emulate)** | `rules/emulate-stateful-testing.md` | **HIGH** |
| API endpoint tests | `rules/integration-api.md` | HIGH |
| React component integration | `rules/integration-component.md` | HIGH |
| Database layer testing | `rules/integration-database.md` | HIGH |
| Zod schema validation | `rules/validation-zod-schema.md` | HIGH |
| Pact contract testing | `rules/verification-contract.md` | MEDIUM |
| Stateful testing (Hypothesis) | `rules/verification-stateful.md` | MEDIUM |
| Evidence & property-based | `rules/verification-techniques.md` | MEDIUM |

### References

| Topic | File |
|-------|------|
| Consumer-side Pact tests | `references/consumer-tests.md` |
| Pact Broker CI/CD | `references/pact-broker.md` |
| Provider verification setup | `references/provider-verification.md` |
| Hypothesis strategies guide | `references/strategies-guide.md` |

### Checklists

| Checklist | File |
|-----------|------|
| Contract testing readiness | `checklists/contract-testing-checklist.md` |
| Property-based testing | `checklists/property-testing-checklist.md` |

### Scripts & Templates

| Script | File |
|--------|------|
| Create integration test | `scripts/create-integration-test.md` |
| Test plan template | `scripts/test-plan-template.md` |

### Examples

| Example | File |
|---------|------|
| Full testing strategy | `examples/orchestkit-test-strategy.md` |

---

## Stateful API Testing (emulate — FIRST CHOICE)

For GitHub, Vercel, and Google API integration tests, **emulate is the first choice**. It provides full state machines that model real API behavior — not static mocks.

| Tool | Best For |
|------|----------|
| **emulate** | Stateful API tests (GitHub/Vercel/Google) — FIRST CHOICE |
| Pact | Cross-team contract verification |
| MSW | Frontend HTTP mocking (simple request/response) |
| Nock | Node.js unit-level HTTP interception |

See `rules/emulate-stateful-testing.md` for the full decision matrix, seed-start-test-assert pattern, and incorrect/correct examples.

---

## Testcontainers (real dependencies in CI)

When contract tests and emulate aren't enough — e.g. testing against real Postgres, Redis, Kafka, or an S3-compatible store — **Testcontainers** spins up ephemeral Docker containers per test and tears them down afterward. `path_patterns` above already matches `**/testcontainers/**`; use these patterns there.

**Target**: `testcontainers >= 11.0.0` (Node) — v11 (Q1 2026) added named-network auto-cleanup, reusable containers via `.withReuse()`, and first-class Podman support.

### Node.js (testcontainers-node)

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { describe, beforeAll, afterAll, test, expect } from 'vitest'

describe('UserRepository integration', () => {
  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>
  let repo: UserRepository

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('test')
      .withUsername('test')
      .withPassword('test')
      .withReuse()  // v11+ — reuse across runs to speed CI
      .start()

    repo = new UserRepository(container.getConnectionUri())
    await repo.migrate()
  }, 30_000)

  afterAll(async () => {
    await container.stop()
  })

  test('persists and retrieves a user', async () => {
    const created = await repo.create({ email: 'a@b.c' })
    const found = await repo.findById(created.id)
    expect(found?.email).toBe('a@b.c')
  })
})
```

### Python (testcontainers-python)

```python
from testcontainers.postgres import PostgresContainer
import pytest

@pytest.fixture(scope="session")
def postgres():
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg.get_connection_url()

def test_user_repo(postgres):
    repo = UserRepository(postgres)
    repo.migrate()
    user = repo.create(email="a@b.c")
    assert repo.find_by_id(user.id).email == "a@b.c"
```

**Decision matrix**:

| Scenario | Pick |
|----------|------|
| Third-party API (GitHub, Vercel, Google) | emulate |
| Cross-team API contract | Pact |
| Real Postgres / Redis / Kafka integration | **Testcontainers** |
| Just mocking HTTP in a frontend test | MSW |

---

## Quick Start: API Integration Test

### TypeScript (Supertest)

```typescript
import request from 'supertest';
import { app } from '../app';

describe('POST /api/users', () => {
  test('creates user and returns 201', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', name: 'Test' });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.email).toBe('test@example.com');
  });

  test('returns 400 for invalid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'invalid', name: 'Test' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('email');
  });
});
```

### Python (FastAPI + httpx)

```python
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_create_user(client: AsyncClient):
    response = await client.post(
        "/api/users",
        json={"email": "test@example.com", "name": "Test"}
    )
    assert response.status_code == 201
    assert response.json()["email"] == "test@example.com"
```

---

## Coverage Targets

| Area | Target |
|------|--------|
| API endpoints | 70%+ |
| Service layer | 80%+ |
| Component interactions | 70%+ |
| Contract tests | All consumer-used endpoints |
| Property tests | All encode/decode, idempotent functions |

---

## Key Principles

1. **Test at boundaries** -- API inputs, database queries, service calls, external integrations
2. **Fresh state per test** -- In-memory databases, transaction rollback, no shared mutable state
3. **Use matchers in contracts** -- `Like()`, `EachLike()`, `Term()` instead of exact values
4. **Property-based for invariants** -- Roundtrip, idempotence, commutativity properties
5. **Validate schemas at edges** -- Zod `.safeParse()` at every API boundary
6. **Evidence-backed completion** -- Exit code 0, coverage reports, timestamps

---

## When to Use This Skill

- Writing API endpoint tests (Supertest, httpx)
- Setting up React component integration tests with providers
- Creating database integration tests with isolation
- Implementing Pact consumer/provider contract tests
- Adding property-based tests with Hypothesis
- Validating Zod schemas at API boundaries
- Planning a testing strategy for a new feature or service

## Related Skills

- `ork:testing-unit` — Unit testing patterns, fixtures, mocking
- `ork:testing-e2e` — End-to-end Playwright tests
- `ork:emulate-seed` — Seed configuration authoring for emulate providers
- `ork:database-patterns` — Database schema and migration patterns
- `ork:api-design` — API design patterns for endpoint testing
