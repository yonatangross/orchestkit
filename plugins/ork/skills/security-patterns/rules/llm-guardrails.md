---
title: Apply output guardrails with schema validation, grounding checks, and content safety filtering
category: llm
impact: HIGH
impactDescription: "Prevents unsafe LLM output through schema validation, grounding checks, and content safety filtering"
tags: guardrails, output-validation, grounding, content-safety
---

# Output Guardrails

## Purpose

After LLM returns, validate output before using it:

1. **Schema:** Response matches expected structure
2. **No IDs:** No hallucinated UUIDs
3. **Grounded:** Claims supported by provided context
4. **Safe:** No toxic/harmful content
5. **Size:** Within limits

## Schema Validation

```python
from pydantic import BaseModel, ValidationError

def validate_schema(llm_output: dict, schema: type[BaseModel]):
    try:
        parsed = schema.model_validate(llm_output)
        return parsed, ValidationResult(status="passed")
    except ValidationError as e:
        return None, ValidationResult(
            status="failed",
            reason=f"Schema error: {e.error_count()} errors",
        )

class AnalysisOutput(BaseModel):
    summary: str
    key_concepts: list[str]
    difficulty: str
```

## No Hallucinated IDs

```python
import re

UUID_PATTERN = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

def validate_no_ids(output: str) -> ValidationResult:
    uuids = re.findall(UUID_PATTERN, output, re.IGNORECASE)
    if uuids:
        return ValidationResult(
            status="failed",
            reason=f"Found {len(uuids)} hallucinated UUIDs",
        )
    return ValidationResult(status="passed")
```

## Grounding Validation

```python
def validate_grounding(output: str, context_texts: list[str], threshold: float = 0.3):
    output_terms = set(extract_key_terms(output))
    context_terms = set()
    for text in context_texts:
        context_terms.update(extract_key_terms(text))

    if not output_terms:
        return ValidationResult(status="warning", reason="No key terms")

    overlap = len(output_terms & context_terms) / len(output_terms)
    if overlap < threshold:
        return ValidationResult(
            status="warning",
            reason=f"Low grounding: {overlap:.2%}",
        )
    return ValidationResult(status="passed")
```

## Content Safety

```python
async def validate_content_safety(output: str):
    # PII detection
    pii_patterns = {
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phone": r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
        "ssn": r'\b\d{3}-\d{2}-\d{4}\b',
    }

    detected_pii = []
    for pii_type, pattern in pii_patterns.items():
        if re.search(pattern, output):
            detected_pii.append(pii_type)

    if detected_pii:
        return ValidationResult(
            status="warning",
            reason=f"PII detected: {detected_pii}",
        )
    return ValidationResult(status="passed")
```

## Combined Validator

```python
async def run_guardrails(
    llm_output: dict,
    context_texts: list[str],
    schema: type[BaseModel],
) -> tuple[BaseModel | None, list[ValidationResult]]:
    results = []

    # 1. Schema
    parsed, result = validate_schema(llm_output, schema)
    results.append(result)
    if not result.is_valid:
        return None, results

    output_str = str(llm_output)

    # 2. No hallucinated IDs
    results.append(validate_no_ids(output_str))

    # 3. Grounding check
    results.append(validate_grounding(output_str, context_texts))

    # 4. Content safety
    results.append(await validate_content_safety(output_str))

    # 5. Size limits
    results.append(validate_size(output_str))

    failures = [r for r in results if r.status == "failed"]
    if failures:
        return None, results

    return parsed, results
```

## Anti-Patterns

```python
# BAD: No validation
artifact.content = llm_response["content"]

# BAD: Only schema validation
parsed = AnalysisOutput.parse_obj(response)

# BAD: Trusting LLM self-assessment
if llm_response.get("is_safe", True):
    use_response(llm_response)

# GOOD: Full guardrail pipeline
parsed, results = await run_guardrails(
    llm_output=response, context_texts=context, schema=AnalysisOutput,
)
```

**Incorrect — Trusting LLM output without validation allows toxic content and hallucinated IDs:**
```python
response = await llm.generate(prompt)
analysis = Analysis(
    content=response["summary"],  # Could be toxic
    document_id=response["doc_id"],  # Hallucinated UUID!
)
await db.save(analysis)
```

**Correct — Multi-layer guardrails validate schema, detect hallucinated IDs, and check grounding:**
```python
response = await llm.generate(prompt)
parsed, results = await run_guardrails(
    llm_output=response, context_texts=context, schema=AnalysisOutput,
)
if not parsed:
    raise ValidationError(f"Guardrails failed: {results}")
# Now safe to use parsed output
```
