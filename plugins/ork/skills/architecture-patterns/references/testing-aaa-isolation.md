---
title: "Test Standards: AAA Pattern & Test Isolation"
category: test-standards
impact: MEDIUM
---

# AAA Pattern & Test Isolation

Arrange-Act-Assert pattern enforcement, test isolation rules, and parameterized test patterns.

## AAA Pattern (Required)

Every test must follow Arrange-Act-Assert. This structure makes tests readable, maintainable, and debuggable.

### TypeScript Example

```typescript
describe('calculateDiscount', () => {
  test('should apply 10% discount for orders over $100', () => {
    // Arrange
    const order = createOrder({ total: 150 });
    const calculator = new DiscountCalculator();

    // Act
    const discount = calculator.calculate(order);

    // Assert
    expect(discount).toBe(15);
  });
});
```

### Python Example

```python
class TestCalculateDiscount:
    def test_applies_10_percent_discount_over_threshold(self):
        # Arrange
        order = Order(total=150)
        calculator = DiscountCalculator()

        # Act
        discount = calculator.calculate(order)

        # Assert
        assert discount == 15
```

### Common AAA Violations

```python
# BLOCKED - No clear structure
def test_discount():
    assert DiscountCalculator().calculate(Order(total=150)) == 15

# BLOCKED - Assert mixed with Act
def test_discount():
    calculator = DiscountCalculator()
    assert calculator.calculate(Order(total=150)) == 15
    assert calculator.calculate(Order(total=50)) == 0
    # Multiple Act+Assert pairs - split into separate tests
```

## Test Isolation (Required)

Tests must not share mutable state. Each test must run independently.

### Shared State Violation

```typescript
// BLOCKED - Shared mutable state
let items = [];

test('adds item', () => {
  items.push('a');
  expect(items).toHaveLength(1);
});

test('removes item', () => {
  // FAILS - items already has 'a' from previous test
  expect(items).toHaveLength(0);
});
```

### Proper Isolation

```typescript
// GOOD - Reset state in beforeEach
describe('ItemList', () => {
  let items: string[];

  beforeEach(() => {
    items = []; // Fresh state each test
  });

  test('adds item', () => {
    items.push('a');
    expect(items).toHaveLength(1);
  });

  test('starts empty', () => {
    expect(items).toHaveLength(0); // Works!
  });
});
```

### Python Isolation with Fixtures

```python
import pytest

# Function scope (default) - Fresh each test
@pytest.fixture
def db_session():
    session = create_session()
    yield session
    session.rollback()

# Each test gets its own session
class TestUserRepository:
    def test_creates_user(self, db_session):
        repo = UserRepository(db_session)
        user = repo.create(UserCreate(email="test@test.com"))
        assert user.id is not None

    def test_gets_user(self, db_session):
        # Fresh session - no data from previous test
        repo = UserRepository(db_session)
        assert repo.get_by_email("test@test.com") is None
```

## Parameterized Tests

Use parameterized tests for multiple similar cases instead of duplicating test bodies.

### TypeScript (test.each)

```typescript
describe('isValidEmail', () => {
  test.each([
    ['user@example.com', true],
    ['invalid', false],
    ['@missing.com', false],
    ['user@domain.co.uk', true],
    ['user+tag@example.com', true],
  ])('isValidEmail(%s) returns %s', (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });
});
```

### Python (pytest.mark.parametrize)

```python
import pytest

class TestIsValidEmail:
    @pytest.mark.parametrize("email,expected", [
        ("user@example.com", True),
        ("invalid", False),
        ("@missing.com", False),
        ("user@domain.co.uk", True),
    ])
    def test_email_validation(self, email: str, expected: bool):
        assert is_valid_email(email) == expected
```

## Test Factory Pattern

Create reusable factory functions for test data.

```python
# tests/factories.py
from dataclasses import dataclass

def create_user(**overrides) -> User:
    """Factory with sensible defaults."""
    defaults = {
        "email": "test@example.com",
        "name": "Test User",
        "is_active": True,
    }
    defaults.update(overrides)
    return User(**defaults)

# Usage
def test_inactive_user_blocked(self):
    user = create_user(is_active=False)
    with pytest.raises(InactiveUserError):
        service.validate_access(user)
```

## One Assert Per Logical Concept

Each test should verify one behavior. Multiple assertions are fine if they all verify the same concept.

```python
# GOOD - Multiple assertions for one concept (user creation)
def test_creates_user_with_defaults(self):
    user = service.create_user(UserCreate(email="test@test.com"))
    assert user.id is not None
    assert user.email == "test@test.com"
    assert user.is_active is True
    assert user.created_at is not None

# BAD - Testing multiple concepts in one test
def test_user_operations(self):
    user = service.create_user(data)
    assert user.id is not None         # creation
    updated = service.update_user(...)  # update (separate test!)
    assert updated.name == "New"
    service.delete_user(user.id)        # delete (separate test!)
```
