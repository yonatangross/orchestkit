---
name: integration-testing
description: Integration testing patterns for APIs and components. Use when testing component interactions, API endpoints with test databases, or service layer integration.
tags: [testing, integration, api, database]
context: fork
agent: test-generator
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# Integration Testing

Test how components work together.

## API Integration Test

```typescript
import { describe, test, expect } from 'vitest';
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

## FastAPI Integration Test

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

@pytest.mark.asyncio
async def test_get_user_not_found(client: AsyncClient):
    response = await client.get("/api/users/nonexistent")

    assert response.status_code == 404
```

## Test Database Setup

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture(scope="function")
def db_session():
    """Fresh database per test."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()
    Base.metadata.drop_all(engine)
```

## React Component Integration

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';

test('form submits and shows success', async () => {
  const user = userEvent.setup();

  render(
    <QueryClientProvider client={queryClient}>
      <UserForm />
    </QueryClientProvider>
  );

  await user.type(screen.getByLabelText('Email'), 'test@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(await screen.findByText(/success/i)).toBeInTheDocument();
});
```

## Coverage Targets

| Area | Target |
|------|--------|
| API endpoints | 70%+ |
| Service layer | 80%+ |
| Component interactions | 70%+ |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Database | In-memory SQLite or test container |
| Execution | < 1s per test |
| External APIs | MSW (frontend), VCR.py (backend) |
| Cleanup | Fresh state per test |

## Common Mistakes

- Shared test database state
- No transaction rollback
- Testing against production APIs
- Slow setup/teardown

## Related Skills

- `unit-testing` - Isolated tests
- `msw-mocking` - Network mocking
- `e2e-testing` - Full flow testing

## Capability Details

### api-testing
**Keywords:** api, endpoint, httpx, testclient
**Solves:**
- Test FastAPI endpoints
- Integration test patterns
- API contract testing

### database-testing
**Keywords:** database, fixture, transaction, rollback
**Solves:**
- Test database operations
- Use transaction rollback
- Create test fixtures

### test-plan-template
**Keywords:** plan, template, strategy, coverage
**Solves:**
- Integration test plan template
- Coverage strategy
- Test organization
