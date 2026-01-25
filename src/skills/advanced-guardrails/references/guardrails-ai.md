# Guardrails AI

## Overview

Guardrails AI provides modular validators for LLM output validation, including PII detection, toxicity filtering, topic restriction, and structured output enforcement.

## Installation

```bash
pip install guardrails-ai

# Install specific validators from Hub
guardrails hub install hub://guardrails/toxic_language
guardrails hub install hub://guardrails/detect_pii
guardrails hub install hub://guardrails/restrict_to_topic
guardrails hub install hub://guardrails/valid_length
guardrails hub install hub://guardrails/response_evaluator
```

## Core Concepts

### Guard Object

```python
from guardrails import Guard
from guardrails.hub import ToxicLanguage, DetectPII, ValidLength

# Create guard with validators
guard = Guard().use_many(
    ToxicLanguage(threshold=0.5, on_fail="filter"),
    DetectPII(on_fail="fix"),  # Redacts PII
    ValidLength(min=10, max=500, on_fail="reask"),
)

# Use guard with LLM
result = guard(
    llm_api=openai.chat.completions.create,
    model="gpt-4o",
    messages=[{"role": "user", "content": user_input}],
)

if result.validation_passed:
    return result.validated_output
else:
    return handle_validation_failure(result)
```

### Validation Actions (on_fail)

| Action | Behavior |
|--------|----------|
| `noop` | Log but continue (monitoring mode) |
| `filter` | Remove failing content |
| `fix` | Attempt to fix (e.g., redact PII) |
| `reask` | Ask LLM to regenerate |
| `refrain` | Return None, refuse to respond |
| `exception` | Raise ValidationError |
| `custom` | Call custom handler function |

## Built-in Validators

### Toxicity Detection

```python
from guardrails.hub import ToxicLanguage

# Sentence-level toxicity checking
toxicity_guard = Guard().use(
    ToxicLanguage(
        threshold=0.5,
        validation_method="sentence",  # or "full"
        on_fail="filter"
    )
)

# Custom threshold per category
toxicity_guard = Guard().use(
    ToxicLanguage(
        threshold=0.5,
        categories={
            "hate": 0.3,      # More strict
            "violence": 0.3,
            "sexual": 0.5,
            "harassment": 0.4,
        },
        on_fail="filter"
    )
)
```

### PII Detection and Redaction

```python
from guardrails.hub import DetectPII

pii_guard = Guard().use(
    DetectPII(
        pii_entities=[
            "EMAIL_ADDRESS",
            "PHONE_NUMBER",
            "CREDIT_CARD",
            "US_SSN",
            "US_PASSPORT",
            "IP_ADDRESS",
            "PERSON",           # Names
            "LOCATION",         # Addresses
            "DATE_TIME",        # Dates that could identify
        ],
        on_fail="fix",  # Redacts detected PII
        # Redaction patterns
        redact_with="[REDACTED]",  # or "[PII]", "***"
    )
)

# Validate output
result = pii_guard.validate("Contact john@example.com at 555-1234")
# Returns: "Contact [REDACTED] at [REDACTED]"
```

### Topic Restriction

```python
from guardrails.hub import RestrictToTopic

topic_guard = Guard().use(
    RestrictToTopic(
        valid_topics=[
            "technology",
            "customer support",
            "product information",
            "billing inquiries",
        ],
        invalid_topics=[
            "politics",
            "religion",
            "competitors",
            "personal opinions",
        ],
        device=-1,  # CPU for classifier
        llm_callable=openai.chat.completions.create,  # For edge cases
        on_fail="refrain",
    )
)
```

### Length Validation

```python
from guardrails.hub import ValidLength

length_guard = Guard().use(
    ValidLength(
        min=10,           # Minimum characters
        max=500,          # Maximum characters
        on_fail="reask",  # Ask LLM to regenerate if too long/short
    )
)
```

### Response Quality Evaluation

```python
from guardrails.hub import ResponseEvaluator

quality_guard = Guard().use(
    ResponseEvaluator(
        llm_callable=openai.chat.completions.create,
        criteria={
            "relevance": "Response directly addresses the user question",
            "accuracy": "Information provided is factually correct",
            "completeness": "Response covers all aspects of the question",
            "clarity": "Response is clear and easy to understand",
        },
        threshold=0.7,  # Minimum score across criteria
        on_fail="reask",
    )
)
```

## Custom Validators

```python
from guardrails import Guard, Validator, register_validator
from guardrails.validators import PassResult, FailResult
from typing import Any, Dict

@register_validator(name="competitor-mention", data_type="string")
class CompetitorMentionValidator(Validator):
    """Blocks mentions of competitor products."""

    def __init__(
        self,
        competitors: list[str],
        on_fail: str = "refrain",
        **kwargs
    ):
        super().__init__(on_fail=on_fail, **kwargs)
        self.competitors = [c.lower() for c in competitors]

    def validate(self, value: str, metadata: Dict[str, Any]) -> PassResult | FailResult:
        value_lower = value.lower()

        for competitor in self.competitors:
            if competitor in value_lower:
                return FailResult(
                    error_message=f"Response mentions competitor: {competitor}",
                    fix_value=self._remove_competitor_mention(value, competitor)
                )

        return PassResult()

    def _remove_competitor_mention(self, text: str, competitor: str) -> str:
        import re
        pattern = rf'\b{re.escape(competitor)}\b'
        return re.sub(pattern, "[COMPETITOR]", text, flags=re.IGNORECASE)

# Usage
guard = Guard().use(
    CompetitorMentionValidator(
        competitors=["CompetitorA", "CompetitorB", "RivalCorp"],
        on_fail="fix"
    )
)
```

## Chained Validation

```python
from guardrails import Guard
from guardrails.hub import (
    ToxicLanguage,
    DetectPII,
    RestrictToTopic,
    ValidLength,
)

# Create comprehensive guard
comprehensive_guard = Guard().use_many(
    # 1. Check toxicity first (fastest rejection)
    ToxicLanguage(threshold=0.5, on_fail="refrain"),

    # 2. Detect and redact PII
    DetectPII(
        pii_entities=["EMAIL_ADDRESS", "PHONE_NUMBER", "US_SSN"],
        on_fail="fix"
    ),

    # 3. Verify topic compliance
    RestrictToTopic(
        valid_topics=["technology", "support"],
        on_fail="refrain"
    ),

    # 4. Check length constraints
    ValidLength(min=20, max=1000, on_fail="reask"),
)

# Validate with all guards
async def validate_llm_output(
    user_input: str,
    system_prompt: str
) -> dict:
    """Validate LLM output through all guards."""
    result = comprehensive_guard(
        llm_api=openai.chat.completions.create,
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ],
        max_tokens=1024,
    )

    return {
        "output": result.validated_output,
        "validation_passed": result.validation_passed,
        "failed_validations": [
            {
                "validator": v.validator_name,
                "error": v.error_message,
            }
            for v in result.validation_summaries
            if not v.passed
        ],
        "raw_output": result.raw_llm_output,
    }
```

## Structured Output Validation

```python
from guardrails import Guard
from pydantic import BaseModel, Field
from typing import Literal

class ProductReview(BaseModel):
    """Structured product review output."""
    sentiment: Literal["positive", "negative", "neutral"]
    summary: str = Field(min_length=20, max_length=200)
    key_points: list[str] = Field(min_length=1, max_length=5)
    confidence: float = Field(ge=0.0, le=1.0)

# Create guard with Pydantic schema
structured_guard = Guard.from_pydantic(
    output_class=ProductReview,
    prompt="""
    Analyze the following product review and extract structured information.

    Review: {review_text}

    Respond with JSON matching the required schema.
    """,
)

# Validate structured output
result = structured_guard(
    llm_api=openai.chat.completions.create,
    model="gpt-4o",
    prompt_params={"review_text": user_review},
)

if result.validation_passed:
    review: ProductReview = result.validated_output
```

## Async Support

```python
import asyncio
from guardrails import AsyncGuard
from guardrails.hub import ToxicLanguage, DetectPII

# Create async guard
async_guard = AsyncGuard().use_many(
    ToxicLanguage(threshold=0.5, on_fail="filter"),
    DetectPII(on_fail="fix"),
)

# Async validation
async def validate_async(messages: list[dict]) -> str:
    result = await async_guard(
        llm_api=openai.chat.completions.acreate,  # Async API
        model="gpt-4o",
        messages=messages,
    )
    return result.validated_output

# Batch validation
async def validate_batch(inputs: list[str]) -> list[str]:
    tasks = [
        validate_async([{"role": "user", "content": inp}])
        for inp in inputs
    ]
    return await asyncio.gather(*tasks)
```

## Logging and Monitoring

```python
from guardrails import Guard
from guardrails.hub import ToxicLanguage
import structlog

logger = structlog.get_logger()

# Custom on_fail handler for logging
def log_and_block(value: str, fail_result) -> str:
    logger.warning(
        "guardrail_violation",
        validator=fail_result.validator_name,
        error=fail_result.error_message,
        input_preview=value[:100],
    )
    return "I cannot respond to that request."

guard = Guard().use(
    ToxicLanguage(
        threshold=0.5,
        on_fail=log_and_block  # Custom handler
    )
)
```

## NeMo Integration

```yaml
# NeMo config.yml
rails:
  config:
    guardrails_ai:
      validators:
        - name: toxic_language
          parameters:
            threshold: 0.5
        - name: guardrails_pii
          parameters:
            entities: ["phone_number", "email"]

  output:
    flows:
      - guardrailsai check output $validator="toxic_language"
      - guardrailsai check output $validator="guardrails_pii"
```

## Best Practices

1. **Order validators by cost**: Put fast checks (length, regex) before slow ones (LLM-based)
2. **Use appropriate on_fail**: `fix` for PII, `refrain` for toxic, `reask` for format
3. **Set realistic thresholds**: Start permissive, tighten based on false positives
4. **Log all failures**: Track validation failures for model improvement
5. **Test with adversarial inputs**: Validate guards handle edge cases
