---
name: unit-testing
description: Unit testing patterns and best practices. Use when writing isolated unit tests, implementing AAA pattern, designing test isolation, or setting coverage targets for business logic.
tags: [testing, unit, tdd, coverage]
context: fork
agent: test-generator
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# Unit Testing

Test isolated business logic with fast, deterministic tests.

## AAA Pattern (Arrange-Act-Assert)

```typescript
describe('calculateDiscount', () => {
  test('applies 10% discount for orders over $100', () => {
    // Arrange
    const order = { items: [{ price: 150 }] };

    // Act
    const result = calculateDiscount(order);

    // Assert
    expect(result).toBe(15);
  });
});
```

## Test Isolation

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockRepo: MockRepository;

  beforeEach(() => {
    // Fresh instances per test
    mockRepo = createMockRepository();
    service = new UserService(mockRepo);
  });

  afterEach(() => {
    // Clean up
    vi.clearAllMocks();
  });
});
```

## Coverage Targets

| Area | Target |
|------|--------|
| Business logic | 90%+ |
| Critical paths | 100% |
| New features | 100% |
| Utilities | 80%+ |

## Parameterized Tests

```typescript
describe('isValidEmail', () => {
  test.each([
    ['test@example.com', true],
    ['invalid', false],
    ['@missing.com', false],
    ['user@domain.co.uk', true],
  ])('isValidEmail(%s) returns %s', (email, expected) => {
    expect(isValidEmail(email)).toBe(expected);
  });
});
```

## Python Example

```python
import pytest

class TestCalculateDiscount:
    def test_applies_discount_over_threshold(self):
        # Arrange
        order = Order(total=150)

        # Act
        discount = calculate_discount(order)

        # Assert
        assert discount == 15

    @pytest.mark.parametrize("total,expected", [
        (100, 0),
        (101, 10.1),
        (200, 20),
    ])
    def test_discount_thresholds(self, total, expected):
        order = Order(total=total)
        assert calculate_discount(order) == expected
```

## Fixture Scoping (2026 Best Practice)

```python
import pytest

# Function scope (default): Fresh instance per test - ISOLATED
@pytest.fixture(scope="function")
def db_session():
    """Each test gets clean database state."""
    session = create_session()
    yield session
    session.rollback()  # Cleanup

# Module scope: Shared across all tests in file - EFFICIENT
@pytest.fixture(scope="module")
def expensive_model():
    """Load once per test file (expensive setup)."""
    return load_large_ml_model()  # 5 seconds to load

# Session scope: Shared across ALL tests - MOST EFFICIENT
@pytest.fixture(scope="session")
def db_engine():
    """Single connection pool for entire test run."""
    engine = create_engine(TEST_DB_URL)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
```

**When to use each scope:**
| Scope | Use Case | Example |
|-------|----------|---------|
| function | Isolated tests, mutable state | db_session, mock objects |
| module | Expensive setup, read-only | ML model, compiled regex |
| session | Very expensive, immutable | DB engine, external service |

## Indirect Parametrization

```python
# Defer expensive setup from collection to runtime
@pytest.fixture
def user(request):
    """Create user with different roles based on parameter."""
    role = request.param  # Receives value from parametrize
    return UserFactory(role=role)

@pytest.mark.parametrize("user", ["admin", "moderator", "viewer"], indirect=True)
def test_permissions(user):
    """Test runs 3 times with different user roles."""
    # user fixture is called with each role
    assert user.can_access("/dashboard") == (user.role in ["admin", "moderator"])

# Combinatorial testing with stacked decorators
@pytest.mark.parametrize("role", ["admin", "user"])
@pytest.mark.parametrize("status", ["active", "suspended"])
def test_access_matrix(role, status):
    """Runs 4 tests: admin/active, admin/suspended, user/active, user/suspended"""
    user = User(role=role, status=status)
    expected = (role == "admin" and status == "active")
    assert user.can_modify() == expected
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Framework | Vitest (modern), Jest (mature), pytest |
| Execution | < 100ms per test |
| Dependencies | None (mock everything external) |
| Coverage tool | c8, nyc, pytest-cov |

## Common Mistakes

- Testing implementation, not behavior
- Slow tests (external calls)
- Shared state between tests
- Over-mocking (testing mocks not code)

## Related Skills

- `integration-testing` - Testing interactions
- `msw-mocking` - Network mocking
- `test-data-management` - Fixtures and factories

## Capability Details

### pytest-patterns
**Keywords:** pytest, python, fixture, parametrize
**Solves:**
- Write pytest unit tests
- Use fixtures effectively
- Parametrize test cases

### vitest-patterns
**Keywords:** vitest, jest, typescript, mock
**Solves:**
- Write Vitest unit tests
- Mock dependencies
- Test React components

### orchestkit-strategy
**Keywords:** orchestkit, strategy, coverage, pyramid
**Solves:**
- OrchestKit test strategy example
- Test coverage targets
- Testing pyramid ratios

### test-case-template
**Keywords:** template, test, structure, arrange
**Solves:**
- Test case template
- Arrange-Act-Assert structure
- Copy-paste test starter
