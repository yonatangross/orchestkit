---
name: testing-integration
license: MIT
compatibility: "Claude Code 2.1.59+."
description: Integration and contract testing patterns — API endpoint tests, component integration, database testing, Pact contract verification, property-based testing, and Zod schema validation. Use when testing API boundaries, verifying contracts, or validating cross-service integration.
tags: [testing, integration, contract, pact, property, zod, api]
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

# Integration & Contract Testing

Focused patterns for testing API boundaries, cross-service contracts, component integration, database layers, property-based verification, and schema validation.

## Quick Reference

| Area | Rule / Reference | Impact |
|------|-----------------|--------|
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
from httpx import AsyncClient
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
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
