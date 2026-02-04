---
name: create-integration-test
description: Create integration test with auto-detected test patterns. Use when creating integration tests.
user-invocable: true
argument-hint: [test-name]
---

Create integration test: $ARGUMENTS

## Test Context (Auto-Detected)

- **Test Database**: !`grep -r "test_database\|TEST_DB" .env* tests/ 2>/dev/null | head -1 || echo "Not detected"`
- **Existing Integration Tests**: !`find tests -name "*integration*" -o -name "*test_*integration*" 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Test Framework**: !`grep -r "pytest\|unittest" pyproject.toml requirements.txt 2>/dev/null | head -1 | grep -oE 'pytest|unittest' || echo "pytest"`
- **API Client**: !`grep -r "httpx\|requests\|testclient" requirements.txt 2>/dev/null | head -1 || echo "httpx (recommended)"`

## Integration Test Template

```python
"""
Integration test: $ARGUMENTS

Test file: tests/integration/test_$ARGUMENTS.py
"""

import pytest
!`grep -q "httpx" requirements.txt 2>/dev/null && echo "from httpx import AsyncClient" || echo "# Install httpx: pip install httpx"`

# TODO: Import your FastAPI app
# from app.main import app

@pytest.mark.integration
async def test_$ARGUMENTS(async_client: AsyncClient):
    """Test $ARGUMENTS integration."""
    # Your test implementation here
    response = await async_client.get("/endpoint")
    assert response.status_code == 200
```

## Usage

1. Review detected test patterns above
2. Create test file: `tests/integration/test_$ARGUMENTS.py`
3. Run: `pytest tests/integration/test_$ARGUMENTS.py -v`
