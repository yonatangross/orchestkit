---
title: "LLM: Structured Output"
category: llm
impact: HIGH
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
