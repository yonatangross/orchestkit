---
title: "Test Standards: Coverage Thresholds & File Location"
category: test-standards
impact: MEDIUM
---

# Coverage Thresholds & Test File Location

Coverage requirements, fixture scope best practices, and test file placement rules.

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
pytest --cov=app --cov-report=html  # HTML report
```

### Coverage Configuration

**Vitest:**

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

**pytest:**

```ini
# pyproject.toml
[tool.coverage.run]
source = ["app"]
omit = ["*/tests/*", "*/migrations/*"]

[tool.coverage.report]
fail_under = 80
show_missing = true
```

## Test File Location Rules

### Allowed Locations

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

### Python Test File Location

```
project/
+-- app/                  # Source code
|   +-- services/
|   +-- repositories/
+-- tests/                # All tests here
    +-- unit/
    |   +-- test_user_service.py
    |   +-- test_order_service.py
    +-- integration/
    |   +-- test_api_users.py
    |   +-- test_api_orders.py
    +-- conftest.py       # Shared fixtures
```

### TypeScript Test File Location

```
project/
+-- src/                  # Source code
|   +-- components/
|   +-- services/
+-- tests/                # Or __tests__/
    +-- unit/
    |   +-- UserService.test.ts
    |   +-- OrderService.test.ts
    +-- integration/
    |   +-- api.test.ts
    +-- setup.ts          # Test setup
```

## Fixture Best Practices (Python)

### Scope Selection

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

### Fixture Scope Guidelines

| Scope | Use When | Example |
|-------|----------|---------|
| `function` (default) | Mutable state, isolation needed | DB sessions, test data |
| `module` | Expensive, read-only setup | ML models, config parsing |
| `session` | Global infrastructure | DB engine, Redis connection |
| `class` | Shared across class methods | Class-level test data |

### conftest.py Organization

```python
# tests/conftest.py - Root level (shared by all tests)
@pytest.fixture(scope="session")
def db_engine():
    engine = create_engine(TEST_DB_URL)
    yield engine
    engine.dispose()

@pytest.fixture
def db_session(db_engine):
    connection = db_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()

# tests/unit/conftest.py - Unit test specific
@pytest.fixture
def mock_repository():
    return Mock(spec=UserRepository)

# tests/integration/conftest.py - Integration test specific
@pytest.fixture
async def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
```

## Common Violations

### 1. Test in Wrong Location

```
BLOCKED: Test file must be in tests/ directory
  File: src/utils/helpers.test.ts
  Move to: tests/utils/helpers.test.ts
```

### 2. Coverage Below Threshold

```
BLOCKED: Coverage 75.2% is below threshold 80%

Actions required:
  1. Add tests for uncovered code
  2. Run: npm test -- --coverage
  3. Ensure coverage >= 80% before proceeding
```

### 3. Tests Mixed with Source

```
BLOCKED: Test file found in source directory
  File: app/routers/test_routes.py
  Move to: tests/integration/test_routes.py
```

## Test Organization Pattern

Organize tests to mirror source structure:

```
# Source
app/
+-- services/
|   +-- user_service.py
|   +-- order_service.py
+-- repositories/
    +-- user_repository.py

# Tests (mirror structure)
tests/
+-- unit/
|   +-- services/
|   |   +-- test_user_service.py
|   |   +-- test_order_service.py
|   +-- repositories/
|       +-- test_user_repository.py
+-- integration/
    +-- test_api_users.py
```
