# Output Guardrails

## Purpose

After LLM returns, validate the output before using it:

```
┌────────────────────────────────────────────────────────────┐
│                  OUTPUT VALIDATION                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  LLM Response ──► Guardrails ──► Validated Output          │
│                       │                                    │
│                       ▼                                    │
│              ┌────────────────┐                            │
│              │   VALIDATORS   │                            │
│              ├────────────────┤                            │
│              │ □ Schema       │  Does it match expected?   │
│              │ □ No IDs       │  No hallucinated UUIDs?    │
│              │ □ Grounded     │  Supported by context?     │
│              │ □ Safe         │  No toxic content?         │
│              │ □ Size         │  Within limits?            │
│              └────────────────┘                            │
│                       │                                    │
│           ┌──────────┴──────────┐                         │
│           ▼                     ▼                         │
│    ┌──────────┐          ┌──────────┐                     │
│    │   PASS   │          │   FAIL   │                     │
│    │          │          │          │                     │
│    │ Continue │          │ Retry or │                     │
│    │          │          │ Error    │                     │
│    └──────────┘          └──────────┘                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Validation Result Type

```python
from dataclasses import dataclass
from enum import Enum

class ValidationStatus(Enum):
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"

@dataclass
class ValidationResult:
    status: ValidationStatus
    reason: str | None = None
    details: dict | None = None

    @property
    def is_valid(self) -> bool:
        return self.status in (ValidationStatus.PASSED, ValidationStatus.WARNING)
```

### 2. Schema Validation

```python
from pydantic import BaseModel, ValidationError
from typing import TypeVar

T = TypeVar("T", bound=BaseModel)

def validate_schema(
    llm_output: dict,
    schema: type[T],
) -> tuple[T | None, ValidationResult]:
    """
    Validate LLM output matches expected schema.
    """
    try:
        parsed = schema.model_validate(llm_output)
        return parsed, ValidationResult(
            status=ValidationStatus.PASSED,
        )
    except ValidationError as e:
        return None, ValidationResult(
            status=ValidationStatus.FAILED,
            reason=f"Schema validation failed: {e.error_count()} errors",
            details={"errors": e.errors()},
        )

# Usage
class AnalysisOutput(BaseModel):
    summary: str
    key_concepts: list[str]
    difficulty: str

parsed, result = validate_schema(llm_response, AnalysisOutput)
if not result.is_valid:
    raise ValidationError(result.reason)
```

### 3. No Hallucinated IDs

```python
import re

UUID_PATTERN = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

def validate_no_ids(output: str) -> ValidationResult:
    """
    Ensure LLM didn't hallucinate any identifiers.
    """
    # Check for UUIDs
    uuids = re.findall(UUID_PATTERN, output, re.IGNORECASE)
    if uuids:
        return ValidationResult(
            status=ValidationStatus.FAILED,
            reason=f"Found {len(uuids)} hallucinated UUIDs",
            details={"uuids": uuids},
        )

    # Check for ID-like patterns
    id_patterns = [
        r'user_id[:\s]+\S+',
        r'doc_id[:\s]+\S+',
        r'id[:\s]+[a-f0-9]{8,}',
    ]

    for pattern in id_patterns:
        matches = re.findall(pattern, output, re.IGNORECASE)
        if matches:
            return ValidationResult(
                status=ValidationStatus.WARNING,
                reason=f"Found ID-like pattern: {matches[0]}",
                details={"matches": matches},
            )

    return ValidationResult(status=ValidationStatus.PASSED)
```

### 4. Grounding Validation

```python
def validate_grounding(
    output: str,
    context_texts: list[str],
    threshold: float = 0.3,
) -> ValidationResult:
    """
    Check if LLM output is grounded in provided context.
    Uses simple keyword overlap for speed.
    """
    # Extract key terms from output
    output_terms = set(extract_key_terms(output))

    # Extract key terms from context
    context_terms = set()
    for text in context_texts:
        context_terms.update(extract_key_terms(text))

    # Calculate overlap
    if not output_terms:
        return ValidationResult(
            status=ValidationStatus.WARNING,
            reason="No key terms in output",
        )

    overlap = len(output_terms & context_terms) / len(output_terms)

    if overlap < threshold:
        return ValidationResult(
            status=ValidationStatus.WARNING,
            reason=f"Low grounding score: {overlap:.2%}",
            details={
                "overlap": overlap,
                "threshold": threshold,
                "ungrounded_terms": list(output_terms - context_terms)[:10],
            },
        )

    return ValidationResult(
        status=ValidationStatus.PASSED,
        details={"grounding_score": overlap},
    )

def extract_key_terms(text: str) -> list[str]:
    """Extract meaningful terms from text"""
    import re
    # Simple: words 4+ chars, lowercased
    words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
    # Filter common words
    stopwords = {'this', 'that', 'with', 'from', 'have', 'been', 'will', 'would'}
    return [w for w in words if w not in stopwords]
```

### 5. Content Safety

```python
async def validate_content_safety(
    output: str,
) -> ValidationResult:
    """
    Check for toxic/harmful content.
    Uses simple pattern matching + optional LLM check.
    """
    # Quick pattern check
    toxic_patterns = [
        r'\b(hate|violence|harm|kill)\b',
        r'\b(password|secret|api.?key)\b',
    ]

    for pattern in toxic_patterns:
        if re.search(pattern, output, re.IGNORECASE):
            return ValidationResult(
                status=ValidationStatus.FAILED,
                reason=f"Potentially unsafe content detected",
            )

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
            status=ValidationStatus.WARNING,
            reason=f"Potential PII detected: {detected_pii}",
            details={"pii_types": detected_pii},
        )

    return ValidationResult(status=ValidationStatus.PASSED)
```

### 6. Size Limits

```python
def validate_size(
    output: str,
    max_chars: int = 50000,
    max_tokens: int = 10000,
) -> ValidationResult:
    """
    Ensure output is within size limits.
    """
    if len(output) > max_chars:
        return ValidationResult(
            status=ValidationStatus.FAILED,
            reason=f"Output exceeds {max_chars} chars: {len(output)}",
        )

    # Rough token estimate
    estimated_tokens = len(output) // 4
    if estimated_tokens > max_tokens:
        return ValidationResult(
            status=ValidationStatus.WARNING,
            reason=f"Output may exceed token limit: ~{estimated_tokens}",
        )

    return ValidationResult(status=ValidationStatus.PASSED)
```

### 7. Combined Validator

```python
from dataclasses import dataclass

@dataclass
class GuardrailsConfig:
    validate_schema: bool = True
    validate_no_ids: bool = True
    validate_grounding: bool = True
    validate_safety: bool = True
    validate_size: bool = True
    grounding_threshold: float = 0.3
    max_output_chars: int = 50000

async def run_guardrails(
    llm_output: dict,
    context_texts: list[str],
    schema: type[BaseModel],
    config: GuardrailsConfig = GuardrailsConfig(),
) -> tuple[BaseModel | None, list[ValidationResult]]:
    """
    Run all guardrails on LLM output.
    Returns parsed output and all validation results.
    """
    results = []
    parsed = None

    # 1. Schema validation
    if config.validate_schema:
        parsed, result = validate_schema(llm_output, schema)
        results.append(result)
        if not result.is_valid:
            return None, results  # Stop early

    output_str = str(llm_output)

    # 2. No hallucinated IDs
    if config.validate_no_ids:
        result = validate_no_ids(output_str)
        results.append(result)

    # 3. Grounding check
    if config.validate_grounding:
        result = validate_grounding(
            output_str,
            context_texts,
            config.grounding_threshold,
        )
        results.append(result)

    # 4. Content safety
    if config.validate_safety:
        result = await validate_content_safety(output_str)
        results.append(result)

    # 5. Size limits
    if config.validate_size:
        result = validate_size(output_str, config.max_output_chars)
        results.append(result)

    # Check for failures
    failures = [r for r in results if r.status == ValidationStatus.FAILED]
    if failures:
        return None, results

    return parsed, results
```

## OrchestKit Integration

```python
# backend/app/workflows/agents/content_analyzer.py

async def analyze_with_guardrails(state: AnalysisState) -> AnalysisState:
    """Run LLM with output guardrails"""

    # Call LLM
    llm_response = await llm.generate(state.prompt)

    # Run guardrails
    parsed, validations = await run_guardrails(
        llm_output=llm_response,
        context_texts=state.context_texts,
        schema=AnalysisOutput,
    )

    # Log validations
    for v in validations:
        if v.status != ValidationStatus.PASSED:
            logger.warning(
                "guardrail_issue",
                status=v.status.value,
                reason=v.reason,
                trace_id=state.request_context.trace_id,
            )

    if parsed is None:
        raise GuardrailError(
            "LLM output failed validation",
            validations=[v for v in validations if not v.is_valid],
        )

    return state.with_output(parsed)
```

## Common Mistakes

```python
# ❌ BAD: No validation
artifact.content = llm_response["content"]  # Could be anything!

# ❌ BAD: Only schema validation
parsed = AnalysisOutput.parse_obj(response)  # Ignores content issues

# ❌ BAD: Trusting LLM completely
if llm_response.get("is_safe", True):  # LLM said it's safe!
    use_response(llm_response)

# ✅ GOOD: Full guardrail pipeline
parsed, results = await run_guardrails(
    llm_output=response,
    context_texts=context,
    schema=AnalysisOutput,
)
```

## Testing Guardrails

```python
class TestGuardrails:

    def test_detects_hallucinated_uuid(self):
        output = "Analysis for doc 123e4567-e89b-12d3-a456-426614174000"
        result = validate_no_ids(output)
        assert result.status == ValidationStatus.FAILED

    def test_detects_low_grounding(self):
        output = "This is about quantum physics and black holes"
        context = ["Python programming tutorial"]
        result = validate_grounding(output, context)
        assert result.status == ValidationStatus.WARNING

    async def test_detects_pii(self):
        output = "Contact john@example.com for details"
        result = await validate_content_safety(output)
        assert result.status == ValidationStatus.WARNING
        assert "email" in result.details["pii_types"]

    async def test_full_pipeline_passes(self):
        valid_output = {
            "summary": "Introduction to machine learning",
            "key_concepts": ["ML", "training", "models"],
            "difficulty": "intermediate",
        }
        context = ["Machine learning is a subset of AI..."]

        parsed, results = await run_guardrails(
            llm_output=valid_output,
            context_texts=context,
            schema=AnalysisOutput,
        )

        assert parsed is not None
        assert all(r.is_valid for r in results)
```
