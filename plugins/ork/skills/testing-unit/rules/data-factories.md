---
title: Build reusable test data factories with realistic randomization for isolated tests
category: data
impact: MEDIUM
impactDescription: "Provides reusable test data builders with realistic randomization for isolated, maintainable tests"
tags: test-data, factories, faker, factoryboy, isolation
---

# Test Data Factories

## Python (FactoryBoy)

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
```

## TypeScript (faker)

```typescript
import { faker } from '@faker-js/faker';

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
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Strategy | Factories over fixtures |
| Faker | Use for realistic random data |
| Scope | Function-scoped for isolation |

**Incorrect — Hard-coded test data that causes conflicts:**
```python
def test_create_user():
    user = User(id=1, email="test@example.com")
    db.add(user)
    # Hard-coded ID causes failures when test runs multiple times
```

**Correct — Factory-generated data with realistic randomization:**
```python
def test_create_user():
    user = UserFactory()  # Generates unique email, random name
    db.add(user)
    assert user.email.endswith('@example.com')
```
