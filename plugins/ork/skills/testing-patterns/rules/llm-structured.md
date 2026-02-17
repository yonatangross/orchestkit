---
title: "LLM: Structured Output"
category: llm
impact: HIGH
impactDescription: "Validates LLM response schemas and timeout behavior through Pydantic validation and async timeout testing"
tags: llm, structured-output, pydantic, timeout, schema-validation
---

# Structured Output and Timeout Testing

## Timeout Testing

```python
import asyncio
import pytest

@pytest.mark.asyncio
async def test_respects_timeout():
    with pytest.raises(asyncio.TimeoutError):
        async with asyncio.timeout(0.1):
            await slow_llm_call()
```

## Schema Validation

```python
from pydantic import BaseModel, Field

class LLMResponse(BaseModel):
    answer: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    sources: list[str] = Field(default_factory=list)

@pytest.mark.asyncio
async def test_structured_output():
    result = await get_llm_response("test query")
    parsed = LLMResponse.model_validate(result)
    assert parsed.confidence > 0
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Timeout | Always test with < 1s timeout |
| Schema validation | Test both valid and invalid |
| Edge cases | Test all null/empty paths |

**Incorrect — No schema validation on LLM output:**
```python
async def test_llm_response():
    result = await get_llm_response("test query")
    assert result["answer"]  # Crashes if "answer" missing
    assert result["confidence"] > 0  # No type checking
```

**Correct — Pydantic validation ensures schema correctness:**
```python
class LLMResponse(BaseModel):
    answer: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)

async def test_structured_output():
    result = await get_llm_response("test query")
    parsed = LLMResponse.model_validate(result)
    assert 0 <= parsed.confidence <= 1.0
```
