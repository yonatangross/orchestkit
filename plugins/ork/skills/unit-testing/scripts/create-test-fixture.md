---
name: create-test-fixture
description: Create pytest fixture with auto-detected existing fixtures. Use when creating test fixtures.
user-invocable: true
argument-hint: [fixture-name]
---

Create pytest fixture: $ARGUMENTS

## Fixture Context (Auto-Detected)

- **Existing Fixtures**: !`grep -r "@pytest.fixture" tests/ conftest.py 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Test Directory**: !`find . -type d -name "tests" -o -name "__tests__" 2>/dev/null | head -1 || echo "tests/"`
- **Conftest Location**: !`find . -name "conftest.py" 2>/dev/null | head -1 || echo "tests/conftest.py"`
- **Python Version**: !`python --version 2>/dev/null || echo "Python 3.x"`

## Fixture Template

```python
"""
Pytest fixture: $ARGUMENTS

Add to: !`find . -name "conftest.py" 2>/dev/null | head -1 || echo "tests/conftest.py"`
"""

import pytest
!`grep -q "sqlalchemy\|async" tests/conftest.py 2>/dev/null && echo "from sqlalchemy.ext.asyncio import AsyncSession" || echo "# Add async imports if needed"`

@pytest.fixture
def $ARGUMENTS():
    """Fixture for $ARGUMENTS."""
    # Your fixture implementation here
    yield None  # or return your fixture value
    # Cleanup code here (if needed)
```

## Usage

1. Review existing fixtures above
2. Add fixture to conftest.py
3. Use in tests: `def test_something($ARGUMENTS):`
