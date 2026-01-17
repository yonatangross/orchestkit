---
name: pytest-advanced
description: Advanced pytest patterns including custom markers, plugins, hooks, parallel execution, and pytest-xdist. Use when implementing custom test infrastructure, optimizing test execution, or building reusable test utilities.
context: fork
agent: test-generator
version: 1.0.0
tags: [pytest, testing, python, markers, plugins, xdist, 2026]
author: SkillForge
user-invocable: false
---

# Advanced Pytest Patterns

Master pytest's advanced features for scalable, maintainable test suites.

## When to Use

- Building custom test markers for categorization
- Writing pytest plugins and hooks
- Configuring parallel test execution with pytest-xdist
- Creating reusable fixture patterns
- Optimizing test collection and execution

## Custom Markers

### Defining Markers in pyproject.toml

```toml
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks tests requiring external services",
    "smoke: critical path tests for CI/CD",
    "db: tests requiring database connection",
    "llm: tests making LLM API calls (expensive)",
]
```

### Using Markers

```python
import pytest

@pytest.mark.slow
def test_complex_analysis():
    """Takes > 5s to run."""
    result = perform_complex_analysis(large_dataset)
    assert result.is_valid

@pytest.mark.integration
@pytest.mark.db
def test_user_creation_in_database(db_session):
    """Requires both integration environment and database."""
    user = UserService(db_session).create({"email": "test@example.com"})
    assert user.id is not None

@pytest.mark.smoke
def test_health_endpoint(client):
    """Critical path - always runs in CI."""
    response = client.get("/health")
    assert response.status_code == 200
```

### Running with Markers

```bash
# Run only smoke tests
pytest -m smoke

# Run everything except slow tests
pytest -m "not slow"

# Run integration tests that also require db
pytest -m "integration and db"

# Exclude LLM tests in CI (expensive)
pytest -m "not llm"
```

## Parallel Execution with pytest-xdist

### Configuration

```toml
# pyproject.toml
[tool.pytest.ini_options]
addopts = [
    "-n", "auto",           # Auto-detect CPU cores
    "--dist", "loadscope",  # Group by module/class for fixtures
]
```

### Distribution Modes

```python
# loadscope (default): Groups tests by module/class
# Ideal when fixtures are expensive and tests in same module share state
pytest -n auto --dist loadscope

# loadfile: Groups tests by file
# Good balance of parallelism and fixture sharing
pytest -n auto --dist loadfile

# load: Round-robin distribution (maximum parallelism)
# Best when tests are truly independent
pytest -n auto --dist load

# no: Sequential (disable parallelism)
pytest -n auto --dist no  # Or just: pytest
```

### Worker-Isolated Fixtures

```python
import pytest

@pytest.fixture(scope="session")
def db_engine(worker_id):
    """Create isolated database per worker."""
    if worker_id == "master":
        # Not running in parallel
        db_name = "test_db"
    else:
        # worker_id is like "gw0", "gw1", etc.
        db_name = f"test_db_{worker_id}"

    engine = create_engine(f"postgresql://localhost/{db_name}")
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)

@pytest.fixture(scope="session")
def redis_db(worker_id):
    """Use different Redis DB per worker."""
    if worker_id == "master":
        db_num = 15
    else:
        db_num = int(worker_id.replace("gw", ""))

    return redis.Redis(db=db_num)
```

## Pytest Hooks

### conftest.py Hooks

```python
# conftest.py
import pytest
import time

# Collection hooks
def pytest_collection_modifyitems(config, items):
    """Reorder tests: smoke first, slow last."""
    smoke_tests = []
    slow_tests = []
    other_tests = []

    for item in items:
        if item.get_closest_marker("smoke"):
            smoke_tests.append(item)
        elif item.get_closest_marker("slow"):
            slow_tests.append(item)
        else:
            other_tests.append(item)

    items[:] = smoke_tests + other_tests + slow_tests

# Test execution hooks
@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Add timing info to test reports."""
    outcome = yield
    report = outcome.get_result()

    if report.when == "call":
        report.user_properties.append(
            ("duration", f"{report.duration:.2f}s")
        )

# Setup/teardown hooks
def pytest_configure(config):
    """Run once at pytest startup."""
    config.test_start_time = time.time()

def pytest_unconfigure(config):
    """Run once at pytest shutdown."""
    elapsed = time.time() - config.test_start_time
    print(f"\nTotal test time: {elapsed:.2f}s")
```

### Custom Pytest Plugin

```python
# pytest_timing_plugin.py
import pytest
from datetime import datetime

class TimingPlugin:
    """Track and report slow tests."""

    def __init__(self, threshold: float = 1.0):
        self.threshold = threshold
        self.slow_tests = []

    @pytest.hookimpl(hookwrapper=True)
    def pytest_runtest_call(self, item):
        start = datetime.now()
        yield
        duration = (datetime.now() - start).total_seconds()

        if duration > self.threshold:
            self.slow_tests.append((item.nodeid, duration))

    def pytest_terminal_summary(self, terminalreporter):
        if self.slow_tests:
            terminalreporter.write_sep("=", "Slow Tests Report")
            for nodeid, duration in sorted(
                self.slow_tests, key=lambda x: -x[1]
            ):
                terminalreporter.write_line(
                    f"  {duration:.2f}s - {nodeid}"
                )

# Register in conftest.py
def pytest_configure(config):
    config.pluginmanager.register(TimingPlugin(threshold=1.0))
```

## Advanced Fixture Patterns

### Factory Fixtures

```python
import pytest
from typing import Callable

@pytest.fixture
def user_factory(db_session) -> Callable[..., User]:
    """Factory fixture for creating users with custom attributes."""
    created_users = []

    def _create_user(**kwargs) -> User:
        defaults = {
            "email": f"user_{len(created_users)}@test.com",
            "name": "Test User",
            "role": "user",
        }
        defaults.update(kwargs)
        user = User(**defaults)
        db_session.add(user)
        db_session.flush()
        created_users.append(user)
        return user

    yield _create_user

    # Cleanup
    for user in created_users:
        db_session.delete(user)
    db_session.flush()

def test_admin_permissions(user_factory):
    admin = user_factory(role="admin")
    user = user_factory(role="user")

    assert admin.can_delete(user)
    assert not user.can_delete(admin)
```

### Async Fixtures with pytest-asyncio

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient

@pytest_asyncio.fixture
async def async_client(app):
    """Async HTTP client for FastAPI testing."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest_asyncio.fixture(scope="session")
async def db_pool():
    """Session-scoped async database pool."""
    pool = await asyncpg.create_pool(TEST_DATABASE_URL)
    yield pool
    await pool.close()

@pytest.mark.asyncio
async def test_create_user(async_client: AsyncClient):
    response = await async_client.post(
        "/api/users",
        json={"email": "test@example.com"}
    )
    assert response.status_code == 201
```

### Fixture Cleanup with Request

```python
@pytest.fixture
def temp_file(request, tmp_path):
    """Create temp file with cleanup registered."""
    file_path = tmp_path / "test_file.txt"
    file_path.write_text("test content")

    def cleanup():
        if file_path.exists():
            file_path.unlink()
        # Additional cleanup logic

    request.addfinalizer(cleanup)
    return file_path
```

## Parameterized Tests

### Advanced Parametrization

```python
import pytest

# Multiple parameter sets with IDs
@pytest.mark.parametrize(
    "input_data,expected",
    [
        pytest.param(
            {"amount": 100, "currency": "USD"},
            {"total": 100.0},
            id="usd-simple",
        ),
        pytest.param(
            {"amount": 100, "currency": "EUR"},
            {"total": 118.0},  # With conversion
            id="eur-with-conversion",
        ),
        pytest.param(
            {"amount": -100, "currency": "USD"},
            pytest.raises(ValueError),
            id="negative-amount",
            marks=pytest.mark.xfail(reason="Validation not implemented"),
        ),
    ],
)
def test_calculate_total(input_data, expected):
    if isinstance(expected, type) and issubclass(expected, Exception):
        with expected:
            calculate_total(**input_data)
    else:
        result = calculate_total(**input_data)
        assert result == expected

# Stacked parametrize (cartesian product)
@pytest.mark.parametrize("status", ["pending", "active", "completed"])
@pytest.mark.parametrize("priority", ["low", "medium", "high"])
def test_task_state_transitions(status, priority):
    """Runs 9 times (3 statuses x 3 priorities)."""
    task = Task(status=status, priority=priority)
    assert task.can_transition()
```

### Indirect Parametrization with Fixtures

```python
@pytest.fixture
def api_client(request):
    """Create client with different auth levels."""
    auth_level = request.param
    client = TestClient(app)

    if auth_level == "admin":
        client.headers["Authorization"] = "Bearer admin-token"
    elif auth_level == "user":
        client.headers["Authorization"] = "Bearer user-token"
    # "anonymous" has no auth header

    return client

@pytest.mark.parametrize(
    "api_client,endpoint,expected_status",
    [
        ("admin", "/admin/users", 200),
        ("user", "/admin/users", 403),
        ("anonymous", "/admin/users", 401),
        ("user", "/api/profile", 200),
        ("anonymous", "/api/profile", 401),
    ],
    indirect=["api_client"],  # api_client param goes to fixture
)
def test_endpoint_permissions(api_client, endpoint, expected_status):
    response = api_client.get(endpoint)
    assert response.status_code == expected_status
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
# NEVER use bare pytest.fixture without scope consideration
@pytest.fixture  # Missing scope - defaults to function (may be wasteful)
def expensive_model():
    return load_ml_model()  # 5 seconds every test!

# NEVER mutate global state in fixtures
_global_counter = 0

@pytest.fixture
def counter():
    global _global_counter
    _global_counter += 1  # WRONG - leaks between tests
    return _global_counter

# NEVER skip cleanup in fixtures
@pytest.fixture
def temp_db():
    db = create_temp_database()
    yield db
    # WRONG - missing cleanup! Database persists

# NEVER use time.sleep in tests (use mocking)
def test_timeout():
    time.sleep(5)  # WRONG - slows test suite
    assert result.is_ready

# NEVER ignore xfail/skip reasons
@pytest.mark.skip  # WRONG - no reason given
def test_broken_feature():
    pass
```

## Related Skills

- `unit-testing` - Basic pytest patterns and AAA structure
- `integration-testing` - Database and API testing patterns
- `property-based-testing` - Hypothesis integration with pytest
- `test-data-management` - Factory patterns for test data

## Capability Details

### custom-markers
**Keywords:** pytest markers, test categorization, smoke tests, slow tests
**Solves:**
- How do I categorize tests in pytest?
- Run only smoke tests in CI
- Skip slow tests during development

### pytest-xdist
**Keywords:** parallel, xdist, distributed, workers, loadscope
**Solves:**
- How do I run pytest tests in parallel?
- Configure worker isolation for databases
- Optimize test distribution strategy

### pytest-hooks
**Keywords:** hook, plugin, conftest, pytest_configure, collection
**Solves:**
- How do I customize pytest behavior?
- Add timing reports to test runs
- Reorder test execution

### fixture-patterns
**Keywords:** fixture, factory, async fixture, cleanup, scope
**Solves:**
- Create factory fixtures for test data
- Configure async fixtures properly
- Ensure fixture cleanup runs

### parametrize-advanced
**Keywords:** parametrize, indirect, cartesian, pytest.param, xfail
**Solves:**
- Test multiple scenarios efficiently
- Use fixtures with parametrized values
- Handle expected failures in parameters
