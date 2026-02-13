# Langfuse Mask Callback

Pre-trace PII masking using Langfuse's mask callback for automatic redaction before data reaches the server.

## Basic Setup

```python
from langfuse import Langfuse
import re

PII_PATTERNS = {
    "email": re.compile(r'\b[\w.-]+@[\w.-]+\.\w{2,}\b'),
    "phone": re.compile(r'\b(?:\+1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b'),
    "ssn": re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
}

def mask_pii(data: dict) -> dict:
    """Mask PII in Langfuse trace data before sending."""
    def redact_string(value: str) -> str:
        for entity_type, pattern in PII_PATTERNS.items():
            value = pattern.sub(f'[REDACTED_{entity_type.upper()}]', value)
        return value

    def redact_recursive(obj):
        if isinstance(obj, str):
            return redact_string(obj)
        elif isinstance(obj, dict):
            return {k: redact_recursive(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [redact_recursive(item) for item in obj]
        return obj

    return redact_recursive(data)

langfuse = Langfuse(mask=mask_pii)
```

## With Presidio

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

def presidio_mask(data: dict) -> dict:
    """Enterprise-grade PII masking with Presidio."""
    def anonymize_string(value: str) -> str:
        if len(value) < 5:
            return value
        results = analyzer.analyze(text=value, language="en")
        if results:
            return anonymizer.anonymize(text=value, analyzer_results=results).text
        return value

    def process_recursive(obj):
        if isinstance(obj, str):
            return anonymize_string(obj)
        elif isinstance(obj, dict):
            return {k: process_recursive(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [process_recursive(item) for item in obj]
        return obj

    return process_recursive(data)

langfuse = Langfuse(mask=presidio_mask)
```

## References

- [Langfuse Mask Callback](https://langfuse.com/docs/sdk/python#mask-callback)
- [Langfuse Privacy](https://langfuse.com/docs/data-security-privacy)
