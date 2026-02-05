---
name: test-data-management
description: Test data management with fixtures and factories. Use when creating test data strategies, implementing data factories, managing fixtures, or seeding test databases.
tags: [testing, fixtures, factories, data]
context: fork
agent: test-generator
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# Test Data Management

Create and manage test data effectively.

## Factory Pattern (Python)

```python
from factory import Factory, Faker, SubFactory, LazyAttribute
from app.models import User, Analysis

class UserFactory(Factory):
    class Meta:
        model = User

    email = Faker('email')
    name = Faker('name')
    created_at = Faker('date_time_this_year')

class AnalysisFactory(Factory):
    class Meta:
        model = Analysis

    url = Faker('url')
    status = 'pending'
    user = SubFactory(UserFactory)

    @LazyAttribute
    def title(self):
        return f"Analysis of {self.url}"

# Usage
user = UserFactory()
analysis = AnalysisFactory(user=user, status='completed')
```

## Factory Pattern (TypeScript)

```typescript
import { faker } from '@faker-js/faker';

interface User {
  id: string;
  email: string;
  name: string;
}

const createUser = (overrides: Partial<User> = {}): User => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  ...overrides,
});

const createAnalysis = (overrides = {}) => ({
  id: faker.string.uuid(),
  url: faker.internet.url(),
  status: 'pending',
  userId: createUser().id,
  ...overrides,
});

// Usage
const user = createUser({ name: 'Test User' });
const analysis = createAnalysis({ userId: user.id, status: 'completed' });
```

## JSON Fixtures

```json
// fixtures/users.json
{
  "admin": {
    "id": "user-001",
    "email": "admin@example.com",
    "role": "admin"
  },
  "basic": {
    "id": "user-002",
    "email": "user@example.com",
    "role": "user"
  }
}
```

```python
import json
import pytest

@pytest.fixture
def users():
    with open('fixtures/users.json') as f:
        return json.load(f)

def test_admin_access(users):
    admin = users['admin']
    assert admin['role'] == 'admin'
```

## Database Seeding

```python
# seeds/test_data.py
async def seed_test_database(db: AsyncSession):
    """Seed database with test data."""
    # Create users
    users = [
        UserFactory.build(email=f"user{i}@test.com")
        for i in range(10)
    ]
    db.add_all(users)

    # Create analyses for each user
    for user in users:
        analyses = [
            AnalysisFactory.build(user_id=user.id)
            for _ in range(5)
        ]
        db.add_all(analyses)

    await db.commit()

@pytest.fixture
async def seeded_db(db_session):
    await seed_test_database(db_session)
    yield db_session
```

## Fixture Composition

```python
@pytest.fixture
def user():
    return UserFactory()

@pytest.fixture
def user_with_analyses(user):
    analyses = [AnalysisFactory(user=user) for _ in range(3)]
    return {"user": user, "analyses": analyses}

@pytest.fixture
def completed_workflow(user_with_analyses):
    for analysis in user_with_analyses["analyses"]:
        analysis.status = "completed"
    return user_with_analyses
```

## Test Data Isolation

```python
@pytest.fixture(autouse=True)
async def clean_database(db_session):
    """Reset database between tests."""
    yield

    # Clean up after test
    await db_session.execute("TRUNCATE users, analyses CASCADE")
    await db_session.commit()
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Strategy | Factories over fixtures |
| Faker | Use for realistic random data |
| Scope | Function-scoped for isolation |
| Cleanup | Always reset between tests |

## Common Mistakes

- Shared state between tests
- Hard-coded IDs (conflicts)
- No cleanup after tests
- Over-complex fixtures

## Related Skills

- `unit-testing` - Test patterns
- `integration-testing` - Database tests
- `database-schema-designer` - Schema design

## Capability Details

### fixture-generation
**Keywords:** fixture, test fixture, pytest fixture, conftest
**Solves:**
- Create reusable test fixtures
- Implement fixture composition
- Handle fixture cleanup

### factory-patterns
**Keywords:** factory, FactoryBoy, test factory, model factory
**Solves:**
- Generate test data with factories
- Implement factory inheritance
- Create related object graphs

### data-seeding
**Keywords:** seed, seed data, database seed, initial data
**Solves:**
- Seed databases for testing
- Create consistent test environments
- Implement idempotent seeding

### cleanup-strategies
**Keywords:** cleanup, teardown, reset, isolation
**Solves:**
- Clean up test data after runs
- Implement transaction rollback
- Ensure test isolation

### data-anonymization
**Keywords:** anonymize, faker, synthetic data, mock data
**Solves:**
- Generate realistic fake data
- Anonymize production data for tests
- Create synthetic datasets
