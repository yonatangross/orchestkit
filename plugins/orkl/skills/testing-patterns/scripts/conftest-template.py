"""
Advanced pytest configuration template.

Includes:
- Custom markers configuration
- Worker isolation for pytest-xdist
- Factory fixtures
- Test reordering
- Timing reports
"""
import pytest
import time
from typing import Callable, Generator
from datetime import datetime


# =============================================================================
# CONFIGURATION
# =============================================================================

def pytest_configure(config):
    """Configure pytest at startup."""
    config.addinivalue_line("markers", "slow: marks tests as slow")
    config.addinivalue_line("markers", "integration: requires external services")
    config.addinivalue_line("markers", "smoke: critical path tests")
    config.addinivalue_line("markers", "db: requires database connection")
    config.addinivalue_line("markers", "llm: makes LLM API calls (expensive)")

    config.test_start_time = time.time()


def pytest_unconfigure(config):
    """Cleanup at pytest shutdown."""
    elapsed = time.time() - config.test_start_time
    print(f"\nTotal test time: {elapsed:.2f}s")


# =============================================================================
# TEST ORDERING
# =============================================================================

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


# =============================================================================
# WORKER ISOLATION (pytest-xdist)
# =============================================================================

@pytest.fixture(scope="session")
def worker_id(request) -> str:
    """Get worker ID for parallel test isolation."""
    if hasattr(request.config, "workerinput"):
        return request.config.workerinput["workerid"]
    return "master"


@pytest.fixture(scope="session")
def db_name(worker_id: str) -> str:
    """Generate unique database name per worker."""
    if worker_id == "master":
        return "test_db"
    return f"test_db_{worker_id}"


# =============================================================================
# FACTORY FIXTURES
# =============================================================================

@pytest.fixture
def user_factory(db_session) -> Generator[Callable, None, None]:
    """
    Factory fixture for creating test users.

    Usage:
        def test_admin(user_factory):
            admin = user_factory(role="admin")
            user = user_factory(role="user")
    """
    created_users = []

    def _create_user(**kwargs):
        from app.models import User

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


# =============================================================================
# TIMING PLUGIN
# =============================================================================

class SlowTestReporter:
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
            terminalreporter.write_sep("=", f"Slow Tests (>{self.threshold}s)")
            for nodeid, duration in sorted(self.slow_tests, key=lambda x: -x[1]):
                terminalreporter.write_line(f"  {duration:.2f}s - {nodeid}")


def pytest_configure_slow_reporter(config):
    """Register slow test reporter plugin (call from pytest_configure)."""
    config.pluginmanager.register(SlowTestReporter(threshold=1.0), "slow_reporter")
