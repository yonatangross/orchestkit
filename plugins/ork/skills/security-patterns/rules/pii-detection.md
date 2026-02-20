---
title: Detect PII exposure through regex and ML-based patterns using Presidio and LLM Guard
category: pii
impact: HIGH
impactDescription: "Prevents PII exposure through regex and ML-based detection using Presidio and LLM Guard"
tags: pii-detection, presidio, llm-guard, anonymization
---

# PII Detection Patterns

## Regex-Based Detection

```python
import re

def mask_pii(data, **kwargs):
    """Mask PII using regex patterns."""
    if isinstance(data, str):
        # Credit cards
        data = re.sub(r'\b(?:\d[ -]*?){13,19}\b', '[REDACTED_CC]', data)
        # Emails
        data = re.sub(r'\b[\w.-]+@[\w.-]+\.\w+\b', '[REDACTED_EMAIL]', data)
        # Phone numbers
        data = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[REDACTED_PHONE]', data)
        # SSN
        data = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[REDACTED_SSN]', data)
    return data
```

## Microsoft Presidio Pipeline

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

def detect_pii(text: str, language: str = "en") -> list:
    return analyzer.analyze(
        text=text, language=language,
        entities=["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "CREDIT_CARD", "US_SSN"]
    )

def anonymize_text(text: str, language: str = "en") -> str:
    results = analyzer.analyze(text=text, language=language)
    return anonymizer.anonymize(text=text, analyzer_results=results).text
```

## Presidio Custom Operators

```python
from presidio_anonymizer.entities import OperatorConfig

operators = {
    "PERSON": OperatorConfig("replace", {"new_value": "[PERSON]"}),
    "CREDIT_CARD": OperatorConfig("mask", {"masking_char": "*", "chars_to_mask": 12}),
    "EMAIL_ADDRESS": OperatorConfig("hash", {"hash_type": "sha256"}),
    "US_SSN": OperatorConfig("redact"),
}

anonymized = anonymizer.anonymize(text=text, analyzer_results=results, operators=operators)
```

## Custom Recognizers

```python
from presidio_analyzer import Pattern, PatternRecognizer

internal_id_recognizer = PatternRecognizer(
    supported_entity="INTERNAL_ID",
    patterns=[Pattern(name="internal_id", regex=r"ID-[A-Z]{2}-\d{6}", score=0.9)]
)
analyzer.registry.add_recognizer(internal_id_recognizer)
```

## LLM Guard Anonymization

```python
from llm_guard.input_scanners import Anonymize
from llm_guard.vault import Vault

vault = Vault()
scanner = Anonymize(
    vault=vault, language="en",
    entity_types=["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "CREDIT_CARD"],
    use_faker=True,  # Replace with fake data
)

def sanitize_input(prompt: str) -> tuple[str, bool, float]:
    sanitized_prompt, is_valid, risk_score = scanner.scan(prompt)
    return sanitized_prompt, is_valid, risk_score

# "My name is Jane Smith" -> "My name is [REDACTED_PERSON_1]"
```

## LLM Guard Output Scanning

```python
from llm_guard.output_scanners import Sensitive

sensitive_scanner = Sensitive(
    entity_types=["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "CREDIT_CARD"],
    redact=True,
    threshold=0.5,
)

def check_output_for_pii(prompt: str, output: str):
    sanitized_output, is_valid, risk_score = sensitive_scanner.scan(prompt, output)
    return sanitized_output, is_valid, risk_score
```

## Anti-Patterns

```python
# NEVER log raw PII
logger.info(f"User email: {user.email}")

# NEVER send unmasked data to observability
langfuse.trace(input=raw_prompt)

# ALWAYS mask before logging
logger.info(f"User email: {mask_pii(user.email)}")

# ALWAYS use mask callback
langfuse = Langfuse(mask=mask_pii)
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Detection engine | Presidio (enterprise), regex (simple), LLM Guard (LLM pipelines) |
| Masking strategy | Replace with type tokens `[REDACTED_EMAIL]` |
| Performance | Async/batch for high-throughput |
| Reversibility | LLM Guard Vault for deanonymization |

**Incorrect — Logging raw user input exposes PII to log aggregators:**
```python
logger.info(f"Processing request for {user.email}")
# Logs: "Processing request for john.doe@company.com"
```

**Correct — Detect and mask PII before logging using Presidio:**
```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

results = analyzer.analyze(text=user.email, language="en")
masked = anonymizer.anonymize(text=user.email, analyzer_results=results).text
logger.info(f"Processing request for {masked}")
# Logs: "Processing request for [EMAIL_ADDRESS]"
```
