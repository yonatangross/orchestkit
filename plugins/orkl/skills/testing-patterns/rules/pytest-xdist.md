---
title: "Pytest: Parallel Execution"
category: pytest
impact: HIGH
impactDescription: "Accelerates test suites through pytest-xdist parallel execution with proper worker isolation"
tags: pytest, parallel-testing, xdist, performance, worker-isolation
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
