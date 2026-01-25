---
name: test-standards-enforcer
description: Enforce testing best practices - AAA pattern, naming conventions, isolation, coverage thresholds. Blocks non-compliant tests. Use when writing or reviewing tests.
context: fork
agent: test-generator
version: 1.0.0
author: OrchestKit AI Agent Hub
tags: [testing, quality, enforcement, blocking, aaa-pattern, coverage]
user-invocable: false
---
Enforce 2026 testing best practices with **BLOCKING** validation.

## Validation Rules

### BLOCKING Rules (exit 1)

| Rule | Check | Example Violation |
|------|-------|-------------------|
| **Test Location** | Tests must be in `tests/` or `__tests__/` | `src/utils/helper.test.ts` |
| **AAA Pattern** | Tests must have Arrange/Act/Assert structure | No clear sections |
| **Descriptive Names** | Test names must describe behavior | `test('test1')` |
| **No Shared State** | Tests must not share mutable state | `let globalVar = []` without reset |
| **Coverage Threshold** | Coverage must be ≥ 80% | 75% coverage |

### File Location Rules

```
ALLOWED:
  tests/unit/user.test.ts
  tests/integration/api.test.ts
  __tests__/components/Button.test.tsx
  app/tests/test_users.py
  tests/conftest.py

BLOCKED:
  src/utils/helper.test.ts      # Tests in src/
  components/Button.test.tsx    # Tests outside test dir
  app/routers/test_routes.py    # Tests mixed with source
```

### Naming Conventions

**TypeScript/JavaScript:**
```typescript
// GOOD - Descriptive, behavior-focused
test('should return empty array when no items exist', () => {})
test('throws ValidationError when email is invalid', () => {})
it('renders loading spinner while fetching', () => {})

// BLOCKED - Too short, not descriptive
test('test1', () => {})
test('works', () => {})
it('test', () => {})
```

**Python:**
```python
# GOOD - snake_case, descriptive
def test_should_return_user_when_id_exists():
def test_raises_not_found_when_user_missing():

# BLOCKED - Not descriptive, wrong case
def testUser():      # camelCase
def test_1():        # Not descriptive
```

## AAA Pattern (Required)

Every test must follow Arrange-Act-Assert:

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

## Test Isolation (Required)

Tests must not share mutable state:

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

## Coverage Requirements

| Area | Minimum | Target |
|------|---------|--------|
| Overall | 80% | 90% |
| Business Logic | 90% | 100% |
| Critical Paths | 95% | 100% |
| New Code | 100% | 100% |

### Running Coverage

**TypeScript (Vitest/Jest):**
```bash
npm test -- --coverage
npx vitest --coverage
```

**Python (pytest):**
```bash
pytest --cov=app --cov-report=json
```

## Parameterized Tests

Use parameterized tests for multiple similar cases:

### TypeScript

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

### Python

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

## Fixture Best Practices (Python)

```python
import pytest

# Function scope (default) - Fresh each test
@pytest.fixture
def db_session():
    session = create_session()
    yield session
    session.rollback()

# Module scope - Shared across file
@pytest.fixture(scope="module")
def expensive_model():
    return load_ml_model()  # Only loads once per file

# Session scope - Shared across all tests
@pytest.fixture(scope="session")
def db_engine():
    engine = create_engine(TEST_DB_URL)
    yield engine
    engine.dispose()
```

## Common Violations

### 1. Test in Wrong Location
```
BLOCKED: Test file must be in tests/ directory
  File: src/utils/helpers.test.ts
  Move to: tests/utils/helpers.test.ts
```

### 2. Missing AAA Structure
```
BLOCKED: Test pattern violations detected
  - Tests should follow AAA pattern (Arrange/Act/Assert)
  - Add comments or clear separation between sections
```

### 3. Shared Mutable State
```
BLOCKED: Test pattern violations detected
  - Shared mutable state detected. Use beforeEach to reset state.
```

### 4. Coverage Below Threshold
```
BLOCKED: Coverage 75.2% is below threshold 80%

Actions required:
  1. Add tests for uncovered code
  2. Run: npm test -- --coverage
  3. Ensure coverage >= 80% before proceeding
```

## Related Skills

- `integration-testing` - Component interaction tests
- `e2e-testing` - End-to-end with Playwright
- `msw-mocking` - Network mocking
- `test-data-management` - Fixtures and factories

## Capability Details

### aaa-pattern
**Keywords:** AAA, arrange act assert, test structure, test pattern
**Solves:**
- Enforce Arrange-Act-Assert pattern
- Ensure clear test structure
- Improve test readability

### test-naming
**Keywords:** test name, test naming, descriptive test, test description
**Solves:**
- Enforce descriptive test names
- Block generic test names like test1
- Improve test documentation

### test-location
**Keywords:** test location, test directory, tests folder, where tests
**Solves:**
- Validate test file placement
- Block tests mixed with source
- Enforce test directory structure

### coverage-threshold
**Keywords:** coverage, test coverage, code coverage, 80%, threshold
**Solves:**
- Enforce minimum 80% coverage
- Block merges with low coverage
- Maintain quality standards

### test-isolation
**Keywords:** test isolation, shared state, independent tests, flaky
**Solves:**
- Detect shared mutable state
- Ensure test independence
- Prevent flaky tests
