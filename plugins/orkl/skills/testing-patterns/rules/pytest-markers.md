---
title: "Pytest: Custom Markers"
category: pytest
impact: HIGH
impactDescription: "Enables selective test execution through custom pytest markers for smoke, integration, and slow tests"
tags: pytest, markers, test-organization, ci-optimization, selective-testing
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
