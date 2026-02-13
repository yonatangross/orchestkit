---
title: "Testing: Coverage & Fixtures"
category: testing
impact: MEDIUM
impactDescription: Coverage thresholds ensure critical code paths are tested before deployment
tags: [testing, coverage, fixtures, pytest, vitest, threshold]
---

# Coverage & Fixtures

## Coverage Requirements

| Area | Minimum | Target |
|------|---------|--------|
| Overall | 80% | 90% |
| Business Logic | 90% | 100% |
| Critical Paths | 95% | 100% |
| New Code | 100% | 100% |

## Running Coverage

```bash
# TypeScript (Vitest/Jest)
npm test -- --coverage
npx vitest --coverage

# Python (pytest)
pytest --cov=app --cov-report=json
```

## Fixture Best Practices (Python)

```python
# Function scope (default) - Fresh each test
@pytest.fixture
def db_session():
    session = create_session()
    yield session
    session.rollback()

# Module scope - Shared across file
@pytest.fixture(scope="module")
def expensive_model():
    return load_ml_model()

# Session scope - Shared across all tests
@pytest.fixture(scope="session")
def db_engine():
    engine = create_engine(TEST_DB_URL)
    yield engine
    engine.dispose()
```

## Key Principles

- Enforce minimum 80% coverage before merge
- Use function scope for mutable state, session scope for expensive setup
- Include cleanup via `yield` in fixtures
- 100% coverage required for all new code
