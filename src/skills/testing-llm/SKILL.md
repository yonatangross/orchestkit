---
name: testing-llm
license: MIT
compatibility: "Claude Code 2.1.59+."
description: LLM and AI testing patterns — mock responses, evaluation with DeepEval/RAGAS, structured output validation, and agentic test patterns (generator, healer, planner). Use when testing AI features, validating LLM outputs, or building evaluation pipelines.
tags: [testing, llm, ai, deepeval, ragas, evaluation, mocking]
context: fork
agent: test-generator
version: 2.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# LLM & AI Testing Patterns

Patterns and tools for testing LLM integrations, evaluating AI output quality, mocking responses for deterministic CI, and applying agentic test workflows (planner, generator, healer).

## Quick Reference

| Area | File | Purpose |
|------|------|---------|
| **Rules** | `rules/llm-evaluation.md` | DeepEval quality metrics, Pydantic schema validation, timeout testing |
| **Rules** | `rules/llm-mocking.md` | Mock LLM responses, VCR.py recording, custom request matchers |
| **Reference** | `references/deepeval-ragas-api.md` | Full API reference for DeepEval and RAGAS metrics |
| **Reference** | `references/generator-agent.md` | Transforms Markdown specs into Playwright tests |
| **Reference** | `references/healer-agent.md` | Auto-fixes failing tests (selectors, waits, dynamic content) |
| **Reference** | `references/planner-agent.md` | Explores app and produces Markdown test plans |
| **Checklist** | `checklists/llm-test-checklist.md` | Complete LLM testing checklist (setup, coverage, CI/CD) |
| **Example** | `examples/llm-test-patterns.md` | Full examples: mocking, structured output, DeepEval, VCR, golden datasets |

## When to Use This Skill

- Testing code that calls LLM APIs (OpenAI, Anthropic, etc.)
- Validating RAG pipeline output quality
- Setting up deterministic LLM tests in CI
- Building evaluation pipelines with quality gates
- Applying agentic test patterns (plan -> generate -> heal)

## LLM Mock Quick Start

Mock LLM responses for fast, deterministic unit tests:

```python
from unittest.mock import AsyncMock, patch
import pytest

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

**Key rule:** NEVER call live LLM APIs in CI. Use mocks for unit tests, VCR.py for integration tests.

## DeepEval Quality Quick Start

Validate LLM output quality with multi-dimensional metrics:

```python
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric

test_case = LLMTestCase(
    input="What is the capital of France?",
    actual_output="The capital of France is Paris.",
    retrieval_context=["Paris is the capital of France."],
)

assert_test(test_case, [
    AnswerRelevancyMetric(threshold=0.7),
    FaithfulnessMetric(threshold=0.8),
])
```

## Quality Metrics Thresholds

| Metric | Threshold | Purpose |
|--------|-----------|---------|
| Answer Relevancy | >= 0.7 | Response addresses question |
| Faithfulness | >= 0.8 | Output matches context |
| Hallucination | <= 0.3 | No fabricated facts |
| Context Precision | >= 0.7 | Retrieved contexts relevant |
| Context Recall | >= 0.7 | All relevant contexts retrieved |

## Structured Output Validation

Always validate LLM output with Pydantic schemas:

```python
from pydantic import BaseModel, Field

class LLMResponse(BaseModel):
    answer: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)
    sources: list[str] = Field(default_factory=list)

async def test_structured_output():
    result = await get_llm_response("test query")
    parsed = LLMResponse.model_validate(result)
    assert 0 <= parsed.confidence <= 1.0
```

## VCR.py for Integration Tests

Record and replay LLM API calls for deterministic integration tests:

```python
@pytest.fixture(scope="module")
def vcr_config():
    import os
    return {
        "record_mode": "none" if os.environ.get("CI") else "new_episodes",
        "filter_headers": ["authorization", "x-api-key"],
    }

@pytest.mark.vcr()
async def test_llm_integration():
    response = await llm_client.complete("Say hello")
    assert "hello" in response.content.lower()
```

## Agentic Test Workflow

The three-agent pattern for end-to-end test automation:

```
Planner -> specs/*.md -> Generator -> tests/*.spec.ts -> Healer (auto-fix)
```

1. **Planner** (`references/planner-agent.md`): Explores your app, produces Markdown test plans from PRDs or natural language requests. Requires `seed.spec.ts` for app context.

2. **Generator** (`references/generator-agent.md`): Converts Markdown specs into Playwright tests. Actively validates selectors against the running app. Uses semantic locators (getByRole, getByLabel, getByText).

3. **Healer** (`references/healer-agent.md`): Automatically fixes failing tests by replaying failures, inspecting the DOM, and patching locators/waits. Max 3 healing attempts per test.

## Edge Cases to Always Test

For every LLM integration, cover these paths:

- **Empty/null inputs** -- empty strings, None values
- **Long inputs** -- truncation behavior near token limits
- **Timeouts** -- fail-open vs fail-closed behavior
- **Schema violations** -- invalid structured output
- **Prompt injection** -- adversarial input resistance
- **Unicode** -- non-ASCII characters in prompts and responses

See `checklists/llm-test-checklist.md` for the complete checklist.

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|-----------------|
| Live LLM calls in CI | Mock for unit, VCR for integration |
| Random seeds | Fixed seeds or mocked responses |
| Single metric evaluation | 3-5 quality dimensions |
| No timeout handling | Always set < 1s timeout in tests |
| Hardcoded API keys | Environment variables, filtered in VCR |
| Asserting only `is not None` | Schema validation + quality metrics |
