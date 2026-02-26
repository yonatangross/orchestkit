---
title: Mock LLM responses for deterministic fast unit tests using VCR recording patterns and custom matchers
category: llm
impact: HIGH
impactDescription: "Ensures deterministic, fast unit tests for LLM-dependent code through proper mocking, VCR patterns, and custom request matchers"
tags: llm, mocking, vcr, testing, deterministic, api-testing, cassettes
---

# LLM Response Mocking

```python
from unittest.mock import AsyncMock, patch

@pytest.fixture
def mock_llm():
    mock = AsyncMock()
    mock.return_value = {"content": "Mocked response", "confidence": 0.85}
    return mock

@pytest.mark.asyncio
async def test_with_mocked_llm(mock_llm):
    with patch("app.core.model_factory.get_model", return_value=mock_llm):
        result = await synthesize_findings(sample_findings)
    assert result["summary"] is not None
```

## Anti-Patterns (FORBIDDEN)

```python
# NEVER test against live LLM APIs in CI
response = await openai.chat.completions.create(...)

# NEVER use random seeds (non-deterministic)
model.generate(seed=random.randint(0, 100))

# ALWAYS mock LLM in unit tests
with patch("app.llm", mock_llm):
    result = await function_under_test()

# ALWAYS use VCR.py for integration tests
@pytest.mark.vcr()
async def test_llm_integration():
    ...
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Mock vs VCR | VCR for integration, mock for unit |
| Timeout | Always test with < 1s timeout |
| Edge cases | Test all null/empty paths |

**Incorrect — Testing against live LLM API in CI:**
```python
async def test_summarize():
    response = await openai.chat.completions.create(
        model="gpt-4", messages=[...]
    )
    assert response.choices[0].message.content
    # Slow, expensive, non-deterministic
```

**Correct — Mocking LLM for fast, deterministic tests:**
```python
@pytest.fixture
def mock_llm():
    mock = AsyncMock()
    mock.return_value = {"content": "Mocked summary", "confidence": 0.85}
    return mock

async def test_summarize(mock_llm):
    with patch("app.llm.get_model", return_value=mock_llm):
        result = await summarize("input text")
    assert result["content"] == "Mocked summary"
```

---

# VCR.py for LLM API Recording

## Custom Matchers for LLM Requests

```python
def llm_request_matcher(r1, r2):
    """Match LLM requests ignoring dynamic fields."""
    import json

    if r1.uri != r2.uri or r1.method != r2.method:
        return False

    body1 = json.loads(r1.body)
    body2 = json.loads(r2.body)

    for field in ["request_id", "timestamp"]:
        body1.pop(field, None)
        body2.pop(field, None)

    return body1 == body2

@pytest.fixture(scope="module")
def vcr_config():
    return {"custom_matchers": [llm_request_matcher]}
```

## CI Configuration

```python
@pytest.fixture(scope="module")
def vcr_config():
    import os
    # CI: never record, only replay
    if os.environ.get("CI"):
        record_mode = "none"
    else:
        record_mode = "new_episodes"
    return {"record_mode": record_mode}
```

## Common Mistakes

- Committing cassettes with real API keys
- Using `all` mode in CI (makes live calls)
- Not filtering sensitive data
- Missing cassettes in git

**Incorrect — Recording mode allows live API calls in CI:**
```python
@pytest.fixture(scope="module")
def vcr_config():
    return {"record_mode": "all"}  # Makes live calls in CI
```

**Correct — CI uses 'none' mode to prevent live calls:**
```python
@pytest.fixture(scope="module")
def vcr_config():
    import os
    return {
        "record_mode": "none" if os.environ.get("CI") else "new_episodes",
        "filter_headers": ["authorization", "x-api-key"]
    }
```
