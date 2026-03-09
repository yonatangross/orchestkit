---
title: Optimize test performance through proper fixture scope selection while maintaining isolation
category: unit
impact: CRITICAL
impactDescription: "Optimizes test performance through proper fixture scope selection while maintaining test isolation"
tags: pytest, fixtures, scoping, performance, isolation
---

# Fixture Scoping

```python
# Function scope (default): Fresh instance per test - ISOLATED
@pytest.fixture(scope="function")
def db_session():
    session = create_session()
    yield session
    session.rollback()

# Module scope: Shared across all tests in file - EFFICIENT
@pytest.fixture(scope="module")
def expensive_model():
    return load_large_ml_model()  # 5 seconds to load

# Session scope: Shared across ALL tests - MOST EFFICIENT
@pytest.fixture(scope="session")
def db_engine():
    engine = create_engine(TEST_DB_URL)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
```

## When to Use Each Scope

| Scope | Use Case | Example |
|-------|----------|---------|
| function | Isolated tests, mutable state | db_session, mock objects |
| module | Expensive setup, read-only | ML model, compiled regex |
| session | Very expensive, immutable | DB engine, external service |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Framework | Vitest (modern), Jest (mature), pytest |
| Execution | < 100ms per test |
| Dependencies | None (mock everything external) |
| Coverage tool | c8, nyc, pytest-cov |

**Incorrect — Function-scoped fixture for expensive read-only resource:**
```python
@pytest.fixture  # scope="function" is default
def compiled_regex():
    return re.compile(r"complex.*pattern")  # Recompiled every test
```

**Correct — Module-scoped fixture for expensive read-only resource:**
```python
@pytest.fixture(scope="module")
def compiled_regex():
    return re.compile(r"complex.*pattern")  # Compiled once per module
```
