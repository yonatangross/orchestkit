---
name: llm-testing
description: Testing patterns for LLM-based applications. Use when testing AI/ML integrations, mocking LLM responses, testing async timeouts, or validating structured outputs from LLMs.
---

# LLM Testing Patterns

Test AI applications with deterministic patterns.

## When to Use

- LLM integration testing
- Async timeout validation
- Structured output testing
- Quality gate testing

## Mock LLM Responses

```python
from unittest.mock import AsyncMock, patch

@pytest.fixture
def mock_llm():
    mock = AsyncMock()
    mock.return_value = {
        "content": "Mocked response",
        "confidence": 0.85,
        "tokens_used": 150
    }
    return mock

@pytest.mark.asyncio
async def test_synthesis_with_mocked_llm(mock_llm):
    with patch("app.core.model_factory.get_model", return_value=mock_llm):
        result = await synthesize_findings(sample_findings)

    assert result["summary"] is not None
    assert mock_llm.call_count == 1
```

## Async Timeout Testing

```python
import asyncio
import pytest

@pytest.mark.asyncio
async def test_respects_timeout():
    async def slow_llm_call():
        await asyncio.sleep(10)
        return "result"

    with pytest.raises(asyncio.TimeoutError):
        async with asyncio.timeout(0.1):
            await slow_llm_call()

@pytest.mark.asyncio
async def test_graceful_degradation_on_timeout():
    result = await safe_operation_with_fallback(timeout=0.1)

    assert result["status"] == "fallback"
    assert result["error"] == "Operation timed out"
```

## Pydantic Validation Testing

```python
from pydantic import ValidationError
import pytest

def test_validates_correct_answer_in_options():
    with pytest.raises(ValidationError) as exc_info:
        QuizQuestion(
            question="What is 2+2?",
            options=["3", "4", "5"],
            correct_answer="6",  # Not in options!
            explanation="Basic arithmetic"
        )

    assert "correct_answer" in str(exc_info.value)

def test_accepts_valid_structured_output():
    q = QuizQuestion(
        question="What is 2+2?",
        options=["3", "4", "5"],
        correct_answer="4",
        explanation="Basic arithmetic"
    )
    assert q.correct_answer == "4"
```

## Quality Gate Testing

```python
@pytest.mark.asyncio
async def test_quality_gate_passes_above_threshold():
    state = create_state_with_findings(quality_score=0.85)

    result = await quality_gate_node(state)

    assert result["quality_passed"] is True

@pytest.mark.asyncio
async def test_quality_gate_fails_below_threshold():
    state = create_state_with_findings(quality_score=0.5)

    result = await quality_gate_node(state)

    assert result["quality_passed"] is False
    assert result["retry_reason"] is not None
```

## Template Rendering Tests

```python
from jinja2 import Environment, FileSystemLoader

@pytest.fixture
def jinja_env():
    return Environment(loader=FileSystemLoader("templates/"))

def test_template_handles_empty_data(jinja_env):
    template = jinja_env.get_template("artifact.j2")
    result = template.render(insights={"tldr": {}})

    assert "TL;DR" not in result  # Section skipped

def test_template_handles_none_values(jinja_env):
    template = jinja_env.get_template("artifact.j2")
    result = template.render(insights={
        "tldr": {"summary": None, "key_takeaways": []}
    })

    assert isinstance(result, str)  # No crash
```

## Edge Cases to Test

Always test these scenarios for LLM integrations:

- **Empty inputs:** Empty strings, None values
- **Very long inputs:** Truncation behavior
- **Timeouts:** Fail-open behavior
- **Partial responses:** Incomplete outputs
- **Invalid schema:** Validation failures
- **Division by zero:** Empty list averaging
- **Nested nulls:** Parent exists, child is None

## VCR.py for LLM APIs

```python
@pytest.fixture(scope="module")
def vcr_config():
    return {
        "cassette_library_dir": "tests/cassettes/llm",
        "filter_headers": ["authorization", "x-api-key"],
        "record_mode": "none" if os.environ.get("CI") else "once",
    }

@pytest.mark.vcr()
async def test_llm_completion():
    response = await llm_client.complete(
        model="claude-3-sonnet",
        messages=[{"role": "user", "content": "Say hello"}]
    )

    assert "hello" in response.content.lower()
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Mock vs VCR | VCR for integration, mock for unit |
| Timeout | Always test with < 1s timeout |
| Schema validation | Test both valid and invalid |
| Edge cases | Test all null/empty paths |

## Common Mistakes

- Not mocking LLM in unit tests (slow, costly)
- No timeout handling tests
- Missing schema validation tests
- Testing against live APIs in CI

## Related Skills

- `vcr-http-recording` - Record LLM responses
- `llm-evaluation` - Quality assessment
- `unit-testing` - Test fundamentals
