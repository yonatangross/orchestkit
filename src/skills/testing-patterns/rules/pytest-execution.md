---
title: Enable selective test execution through custom markers and accelerate suites with pytest-xdist parallel execution
category: pytest
impact: HIGH
impactDescription: "Enables selective test execution through custom markers and accelerates test suites through parallel execution with proper worker isolation"
tags: pytest, markers, test-organization, ci-optimization, selective-testing, parallel-testing, xdist, performance, worker-isolation
---

# Custom Pytest Markers

## Configuration

```toml
# pyproject.toml
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks tests requiring external services",
    "smoke: critical path tests for CI/CD",
]
```

## Usage

```python
import pytest

@pytest.mark.slow
def test_complex_analysis():
    result = perform_complex_analysis(large_dataset)
    assert result.is_valid

# Run: pytest -m "not slow"  # Skip slow tests
# Run: pytest -m smoke       # Only smoke tests
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Marker strategy | Category (smoke, integration) + Resource (db, llm) |
| CI fast path | `pytest -m "not slow"` for PR checks |
| Nightly | `pytest` (all markers) for full coverage |

**Incorrect — Using markers without registering them:**
```python
@pytest.mark.slow
def test_complex():
    pass
# Pytest warns: PytestUnknownMarkWarning
```

**Correct — Register markers in pyproject.toml:**
```toml
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow",
    "integration: marks tests requiring external services"
]
```

---

# Parallel Execution with pytest-xdist

## Configuration

```toml
[tool.pytest.ini_options]
addopts = ["-n", "auto", "--dist", "loadscope"]
```

## Worker Database Isolation

```python
@pytest.fixture(scope="session")
def db_engine(worker_id):
    """Isolate database per worker."""
    db_name = "test_db" if worker_id == "master" else f"test_db_{worker_id}"
    engine = create_engine(f"postgresql://localhost/{db_name}")
    yield engine
```

## Distribution Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| loadscope | Group by module/class | DB-heavy tests |
| load | Round-robin | Independent tests |
| each | Send all to each worker | Cross-platform |

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Workers | `-n auto` (match CPU cores) |
| Distribution | `loadscope` for DB tests |
| Fixture scope | `session` for expensive, `function` for mutable |
| Async testing | pytest-asyncio with auto mode |

**Incorrect — Shared database across workers causes conflicts:**
```python
@pytest.fixture(scope="session")
def db_engine():
    return create_engine("postgresql://localhost/test_db")
    # Workers overwrite each other's data
```

**Correct — Isolated database per worker:**
```python
@pytest.fixture(scope="session")
def db_engine(worker_id):
    db_name = f"test_db_{worker_id}" if worker_id != "master" else "test_db"
    return create_engine(f"postgresql://localhost/{db_name}")
```
