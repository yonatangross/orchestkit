# Custom Pytest Plugins

## Plugin Types

### Local Plugins (conftest.py)
For project-specific functionality. Auto-loaded from any `conftest.py`.

```python
# conftest.py
import pytest

def pytest_configure(config):
    """Run once at pytest startup."""
    config.addinivalue_line(
        "markers", "smoke: critical path tests"
    )

def pytest_collection_modifyitems(config, items):
    """Reorder tests: smoke first, slow last."""
    items.sort(key=lambda x: (
        0 if x.get_closest_marker("smoke") else
        2 if x.get_closest_marker("slow") else 1
    ))
```

### Installable Plugins
For reusable functionality across projects.

```python
# pytest_timing_plugin.py
import pytest
from datetime import datetime

class TimingPlugin:
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
            for nodeid, duration in sorted(self.slow_tests, key=lambda x: -x[1]):
                terminalreporter.write_line(f"  {duration:.2f}s - {nodeid}")

def pytest_configure(config):
    config.pluginmanager.register(TimingPlugin(threshold=1.0))
```

## Hook Reference

### Collection Hooks
```python
def pytest_collection_modifyitems(config, items):
    """Modify collected tests."""

def pytest_generate_tests(metafunc):
    """Generate parametrized tests dynamically."""
```

### Execution Hooks
```python
@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Access test results."""
    outcome = yield
    report = outcome.get_result()
    if report.when == "call" and report.failed:
        # Handle failures
        pass
```

### Setup/Teardown Hooks
```python
def pytest_configure(config):
    """Startup hook."""

def pytest_unconfigure(config):
    """Shutdown hook."""

def pytest_sessionstart(session):
    """Session start."""

def pytest_sessionfinish(session, exitstatus):
    """Session end."""
```

## Publishing a Plugin

```toml
# pyproject.toml
[project]
name = "pytest-my-plugin"
version = "1.0.0"

[project.entry-points.pytest11]
my_plugin = "pytest_my_plugin"
```
