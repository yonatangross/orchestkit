---
name: pytest-advanced
description: Advanced pytest patterns including custom markers, plugins, hooks, parallel execution, and pytest-xdist. Use when implementing custom test infrastructure, optimizing test execution, or building reusable test utilities.
context: fork
agent: test-generator
version: 1.0.0
tags: [pytest, testing, python, markers, plugins, xdist, 2026]
author: OrchestKit
user-invocable: false
---

# Advanced Pytest Patterns

Master pytest's advanced features for scalable, maintainable test suites.

## Overview

- Building custom test markers for categorization
- Writing pytest plugins and hooks
- Configuring parallel test execution with pytest-xdist
- Creating reusable fixture patterns
- Optimizing test collection and execution

## Quick Reference

### Custom Markers

```toml
# pyproject.toml
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks tests requiring external services",
    "smoke: critical path tests for CI/CD",
]
```

```python
import pytest

@pytest.mark.slow
def test_complex_analysis():
    result = perform_complex_analysis(large_dataset)
    assert result.is_valid

# Run: pytest -m "not slow"  # Skip slow tests
# Run: pytest -m smoke       # Only smoke tests
```

See [custom-plugins.md](references/custom-plugins.md) for plugin development.

### Parallel Execution (pytest-xdist)

```toml
[tool.pytest.ini_options]
addopts = ["-n", "auto", "--dist", "loadscope"]
```

```python
@pytest.fixture(scope="session")
def db_engine(worker_id):
    """Isolate database per worker."""
    db_name = "test_db" if worker_id == "master" else f"test_db_{worker_id}"
    engine = create_engine(f"postgresql://localhost/{db_name}")
    yield engine
```

See [xdist-parallel.md](references/xdist-parallel.md) for distribution modes.

### Factory Fixtures

```python
@pytest.fixture
def user_factory(db_session) -> Callable[..., User]:
    """Factory fixture for creating users."""
    created = []

    def _create(**kwargs) -> User:
        user = User(**{"email": f"u{len(created)}@test.com", **kwargs})
        db_session.add(user)
        created.append(user)
        return user

    yield _create
    for u in created:
        db_session.delete(u)
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Parallel execution | pytest-xdist with `--dist loadscope` |
| Marker strategy | Category (smoke, integration) + Resource (db, llm) |
| Fixture scope | Function default, session for expensive setup |
| Plugin location | conftest.py for project, package for reuse |
| Async testing | pytest-asyncio with auto mode |

## Anti-Patterns (FORBIDDEN)

```python
# NEVER use expensive fixtures without session scope
@pytest.fixture  # WRONG - loads every test
def model():
    return load_ml_model()  # 5s each time!

# NEVER mutate global state
@pytest.fixture
def counter():
    global _counter
    _counter += 1  # WRONG - leaks between tests

# NEVER skip cleanup
@pytest.fixture
def temp_db():
    db = create_db()
    yield db
    # WRONG - missing db.drop()!

# NEVER use time.sleep (use mocking)
def test_timeout():
    time.sleep(5)  # WRONG - slows tests
```

## Related Skills

- `unit-testing` - Basic pytest patterns and AAA structure
- `integration-testing` - Database and API testing patterns
- `property-based-testing` - Hypothesis integration with pytest

## References

- [Xdist Parallel](references/xdist-parallel.md) - Parallel execution patterns
- [Custom Plugins](references/custom-plugins.md) - Plugin and hook development
- [Conftest Template](scripts/conftest-template.py) - Production conftest.py

## Capability Details

### custom-markers
**Keywords:** pytest markers, test categorization, smoke tests, slow tests
**Solves:** Categorize tests, run subsets in CI, skip expensive tests

### pytest-xdist
**Keywords:** parallel, xdist, distributed, workers, loadscope
**Solves:** Run tests in parallel, worker isolation, optimize distribution

### pytest-hooks
**Keywords:** hook, plugin, conftest, pytest_configure, collection
**Solves:** Customize pytest behavior, add timing reports, reorder tests

### fixture-patterns
**Keywords:** fixture, factory, async fixture, cleanup, scope
**Solves:** Factory fixtures, async fixtures, ensure cleanup runs

### parametrize-advanced
**Keywords:** parametrize, indirect, cartesian, pytest.param, xfail
**Solves:** Test multiple scenarios, fixtures with params, expected failures
