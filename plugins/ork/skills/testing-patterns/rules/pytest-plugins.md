---
title: Build factory fixture patterns and pytest plugins for reusable test infrastructure
category: pytest
impact: HIGH
impactDescription: "Establishes factory fixture patterns and plugin best practices for reusable, maintainable test infrastructure"
tags: pytest, fixtures, plugins, factory-pattern, test-infrastructure
---

# Pytest Plugins and Hooks

## Factory Fixtures

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
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Plugin location | conftest.py for project, package for reuse |
| Async testing | pytest-asyncio with auto mode |
| Fixture scope | Function default, session for expensive setup |

**Incorrect — Expensive fixture without session scope:**
```python
@pytest.fixture
def ml_model():
    return load_large_model()  # 5s, reloaded EVERY test
```

**Correct — Session-scoped fixture for expensive setup:**
```python
@pytest.fixture(scope="session")
def ml_model():
    return load_large_model()  # 5s, loaded ONCE
```
