---
title: "Integration: API Testing"
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
