---
name: testing-llm
license: MIT
compatibility: "Claude Code 2.1.220+."
description: LLM and AI testing patterns — mock responses, evaluation with DeepEval/RAGAS, structured output validation, and agentic test patterns (generator, healer, planner). Use when testing AI features, validating LLM outputs, or building evaluation pipelines.
tags: [testing, llm, ai, deepeval, ragas, evaluation, mocking]
context: fork
agent: test-generator
version: 2.1.0
author: OrchestKit
user-invocable: false
disable-model-invocation: false
complexity: medium
persuasion-type: reference
targets:
  - library: "deepeval"
    version: ">=4.0.0"
  - library: "ragas"
    version: ">=0.4.0"
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

Patterns and tools for testing LLM integrations, evaluating AI output quality, mocking responses for deterministic CI, and applying agentic test workflows (planner, generator, healer). Of that trio only the healer keeps a local reference here; the planner and generator stages belong to the `testing-e2e` skill.

## Quick Reference

| Area | File | Purpose |
|------|------|---------|
| **Rules** | `rules/llm-evaluation.md` | DeepEval quality metrics, Pydantic schema validation, timeout testing |
| **Rules** | `rules/llm-mocking.md` | Mock LLM responses, VCR.py recording, custom request matchers |
| **Reference** | `references/ork-delta.md` | House rules the vendor docs do not carry: GEval and RAGAS API corrections, threshold direction, cassette path, golden-dataset and latency budgets |
| **Reference** | `references/healer-agent.md` | Auto-fixes failing tests (selectors, waits, dynamic content) |
| **Checklist** | `checklists/llm-test-checklist.md` | Complete LLM testing checklist (setup, coverage, CI/CD) |

## Upstream coverage (do not restate)

DeepEval, RAGAS, VCR.py and Playwright document themselves. This skill carries only the
OrchestKit delta (`references/ork-delta.md`) plus the house subsets in `rules/` and
`checklists/`. Fetch the source below instead of expecting the material here.

| Topic | Source |
|-------|--------|
| Full DeepEval metric catalog and per-metric constructor arguments (the house threshold table and the two-metric quick start stay in this file, `rules/llm-evaluation.md` and `checklists/llm-test-checklist.md`) | https://deepeval.com/docs/metrics-introduction |
| `GEval` custom criteria: `evaluation_params`, `evaluation_steps`, `criteria` (the house import correction stays in `references/ork-delta.md`) | https://deepeval.com/docs/metrics-llm-evals |
| `HallucinationMetric` arguments (the house 0.3 ceiling and the inverted-direction warning stay in `references/ork-delta.md`) | https://deepeval.com/docs/metrics-hallucination |
| RAGAS metric catalog (`Faithfulness`, `LLMContextRecall`, `FactualCorrectness`) | https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/ |
| `EvaluationDataset` construction (the house note on the post-0.2 field names stays in `references/ork-delta.md`) | https://docs.ragas.io/en/stable/concepts/components/eval_dataset/ |
| VCR.py configuration keys (the house record-mode gate and header filters stay in `rules/llm-mocking.md`) | https://vcrpy.readthedocs.io/en/latest/configuration.html |
| Playwright Planner and Generator agents, `init-agents` CLI and generated files (the house healer subset stays in `references/healer-agent.md`) | https://playwright.dev/docs/test-agents |
| Playwright semantic locator ladder used by generated tests | `testing-e2e` skill (`rules/e2e-playwright.md`) plus https://playwright.dev/docs/locators |
| Confidence intervals over metric score samples | https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.t.html |

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

## Library notes (DeepEval, RAGAS)

**DeepEval** metrics expose a `reason` field alongside the numeric score when `include_reason=True`, so a failing CI build gets a human-readable explanation without a second LLM call:

```python
metric = AnswerRelevancyMetric(threshold=0.7, include_reason=True)
metric.measure(test_case)
print(metric.score, metric.reason)
# 0.62  "Response addresses the topic but omits the date asked for."
```

**RAGAS** uses a class-based metric API — instantiate metric classes and pass an `EvaluationDataset`. `llm=` is optional; omit it to use the configured default grader:

```python
from ragas import evaluate
from ragas.metrics import Faithfulness, LLMContextRecall

result = evaluate(
    dataset,
    metrics=[Faithfulness(), LLMContextRecall()],
)
```

> Bump floors: `deepeval >= 4.0`, `ragas >= 0.4`.

House rules the vendor docs do not state (the inverted `HallucinationMetric` threshold,
the `gpt-5-mini` grader default, the 95 percent confidence-interval recipe, and the
latency, quality-gate and truncation numbers) are recorded in `references/ork-delta.md`.
Read that before writing either library's setup code.

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

1. **Planner**: Explores your app and produces Markdown test plans. Owned by the
   `testing-e2e` skill (`rules/e2e-ai-agents.md`); the CLI and its generated files are
   documented at https://playwright.dev/docs/test-agents.

2. **Generator**: Converts Markdown specs into Playwright tests, validating selectors
   against the running app. Also owned by `testing-e2e` (`rules/e2e-ai-agents.md`); the
   locator ladder it follows lives in `testing-e2e` `rules/e2e-playwright.md`.

3. **Healer** (`references/healer-agent.md`): Automatically fixes failing tests by replaying failures, inspecting the DOM, and patching locators/waits. Max 3 healing attempts per test.

Agent initialization is CLI-only (`npx playwright init-agents`); there is no config key
for it. Only the healing stage keeps a local reference, because its 3-attempt ceiling and
its refusal to touch test logic are house limits rather than vendor defaults.

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

## Related Skills

- `ork:testing-unit` — Unit testing fundamentals, AAA pattern
- `ork:testing-integration` — Integration testing for AI pipelines
- `ork:golden-dataset` — Evaluation dataset management
- `ork:testing-e2e` owns the Planner and Generator agent workflow and the Playwright locator ladder
- `ork:testing-perf` owns the latency and load budgets referenced in `references/ork-delta.md`
