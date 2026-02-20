---
title: Mock LLM responses for deterministic fast unit tests using VCR recording patterns
category: llm
impact: HIGH
impactDescription: "Ensures deterministic, fast unit tests for LLM-dependent code through proper mocking and VCR patterns"
tags: llm, mocking, vcr, testing, deterministic
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
