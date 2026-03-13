---
title: Validate API contract correctness and error handling through HTTP-level integration tests
category: integration
impact: HIGH
impactDescription: "Validates API contract correctness and error handling through HTTP-level integration tests"
tags: api-testing, integration, supertest, httpx, http
---

# API Integration Testing

## TypeScript (Supertest)

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

## Python (FastAPI + httpx)

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

## Coverage Targets

| Area | Target |
|------|--------|
| API endpoints | 70%+ |
| Service layer | 80%+ |
| Component interactions | 70%+ |

**Incorrect — Only testing happy path:**
```typescript
test('creates user', async () => {
  const response = await request(app)
    .post('/api/users')
    .send({ email: 'test@example.com' });
  expect(response.status).toBe(201);
  // Missing: validation errors, auth failures
});
```

**Correct — Testing both success and error cases:**
```typescript
test('creates user with valid data', async () => {
  const response = await request(app)
    .post('/api/users')
    .send({ email: 'test@example.com', name: 'Test' });
  expect(response.status).toBe(201);
});

test('rejects invalid email', async () => {
  const response = await request(app)
    .post('/api/users')
    .send({ email: 'invalid' });
  expect(response.status).toBe(400);
});
```

## RFC 9457 Error Response Assertions

When APIs return RFC 9457 Problem Details, assert the structured fields — not just status codes:

```typescript
// Assert RFC 9457 structure on error responses
function assertProblemDetail(response: request.Response, expectedStatus: number) {
  expect(response.status).toBe(expectedStatus);
  expect(response.headers['content-type']).toContain('application/problem+json');
  expect(response.body.type).toBeDefined();
  expect(response.body.status).toBe(expectedStatus);
  expect(response.body.title).toBeDefined();
  // Agent-facing extensions
  expect(response.body.error_category).toBeDefined();
  expect(typeof response.body.retryable).toBe('boolean');
}

test('rate limit returns structured error with retry_after', async () => {
  const response = await request(app).get('/api/data').set('Accept', 'application/problem+json');
  assertProblemDetail(response, 429);
  expect(response.body.retryable).toBe(true);
  expect(response.body.retry_after).toBeGreaterThan(0);
  expect(response.body.error_category).toBe('rate_limit');
});
```

```python
# Python: RFC 9457 error structure assertions
def assert_problem_detail(response, expected_status: int):
    assert response.status_code == expected_status
    assert "application/problem+json" in response.headers.get("content-type", "")
    body = response.json()
    assert "type" in body
    assert body["status"] == expected_status
    assert "title" in body
    assert "error_category" in body
    assert isinstance(body["retryable"], bool)
    if body["retryable"]:
        assert "retry_after" in body

@pytest.mark.asyncio
async def test_rate_limit_returns_structured_error(client: AsyncClient):
    response = await client.get(
        "/api/data",
        headers={"Accept": "application/problem+json"},
    )
    assert_problem_detail(response, 429)
    assert response.json()["error_category"] == "rate_limit"
    assert response.json()["retry_after"] > 0
```

**Incorrect — asserting only status code:**
```typescript
test('returns 429', async () => {
  const response = await request(app).get('/api/data');
  expect(response.status).toBe(429);
  // Missing: no check for structured fields, agent can't branch deterministically
});
```

**Correct — asserting RFC 9457 structure for agent consumers:**
```typescript
test('returns structured 429 with retry signal', async () => {
  const response = await request(app).get('/api/data');
  assertProblemDetail(response, 429);
  expect(response.body.retryable).toBe(true);
  expect(response.body.retry_after).toBeGreaterThan(0);
});
```
