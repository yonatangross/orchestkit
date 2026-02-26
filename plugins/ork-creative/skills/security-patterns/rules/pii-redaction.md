---
title: Redact PII from logs and traces automatically in Langfuse, structlog, and observability tools
category: pii
impact: HIGH
impactDescription: "Prevents PII leakage in logs and traces through automatic redaction in Langfuse, structlog, and observability tools"
tags: pii-redaction, langfuse, logging, observability, presidio
---

# PII Redaction & Observability Integration

## Langfuse Mask Callback

```python
import re
from langfuse import Langfuse

PII_PATTERNS = {
    "email": re.compile(r'\b[\w.-]+@[\w.-]+\.\w{2,}\b'),
    "phone": re.compile(r'\b(?:\+1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b'),
    "ssn": re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
}

def mask_pii(data: dict) -> dict:
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

## Langfuse with Presidio

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

def presidio_mask(data: dict) -> dict:
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

## Structlog PII Processor

```python
import structlog

PII_PATTERNS = {
    "email": re.compile(r'\b[\w.-]+@[\w.-]+\.\w{2,}\b'),
    "phone": re.compile(r'\b(?:\+1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b'),
    "ssn": re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
    "credit_card": re.compile(r'\b(?:\d[ -]*?){13,19}\b'),
}

def redact_pii(logger, method_name: str, event_dict: dict) -> dict:
    def redact_value(value):
        if isinstance(value, str):
            result = value
            for entity_type, pattern in PII_PATTERNS.items():
                result = pattern.sub(f'[REDACTED_{entity_type.upper()}]', result)
            return result
        elif isinstance(value, dict):
            return {k: redact_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [redact_value(item) for item in value]
        return value

    return {k: redact_value(v) for k, v in event_dict.items()}

structlog.configure(processors=[
    structlog.processors.add_log_level,
    structlog.processors.TimeStamper(fmt="iso"),
    redact_pii,
    structlog.processors.JSONRenderer(),
])
```

## Loguru PII Filter

```python
from loguru import logger

def pii_filter(record):
    message = record["message"]
    for entity_type, pattern in PII_PATTERNS.items():
        message = pattern.sub(f'[REDACTED_{entity_type.upper()}]', message)
    record["message"] = message
    return True

logger.remove()
logger.add("logs/app.log", filter=pii_filter, serialize=True)

# Usage
logger.info("User john@example.com logged in from 192.168.1.1")
# Output: "User [REDACTED_EMAIL] logged in from [REDACTED_IP]"
```

## Field-Specific Redaction

```python
SENSITIVE_FIELDS = {
    "email", "phone", "ssn", "credit_card", "password",
    "api_key", "token", "secret", "authorization"
}

def smart_redact_processor(logger, method_name, event_dict):
    result = {}
    for key, value in event_dict.items():
        if key.lower() in SENSITIVE_FIELDS:
            result[key] = "[REDACTED]"
        elif isinstance(value, str):
            result[key] = redact_pii_patterns(value)
        else:
            result[key] = value
    return result
```

## LLM Guard Deanonymization

```python
from llm_guard.input_scanners import Anonymize
from llm_guard.output_scanners import Deanonymize
from llm_guard.vault import Vault

vault = Vault()
anonymize = Anonymize(vault=vault, language="en")
deanonymize = Deanonymize(vault=vault)

# Anonymize input
sanitized_prompt, _, _ = anonymize.scan(original_prompt)

# Call LLM with sanitized input
llm_response = await llm.generate(sanitized_prompt)

# Restore original values in output
restored_output, _, _ = deanonymize.scan(sanitized_prompt, llm_response)
```

## Full Secure Pipeline

```python
class SecureLLMPipeline:
    def __init__(self):
        self.vault = Vault()
        self.anonymize = Anonymize(vault=self.vault, language="en")
        self.deanonymize = Deanonymize(vault=self.vault)
        self.sensitive_check = Sensitive(redact=True)

    async def process(self, user_input: str) -> str:
        # 1. Anonymize input
        sanitized_input, _, input_risk = self.anonymize.scan(user_input)

        # 2. Call LLM with sanitized input
        llm_response = await self.llm.generate(sanitized_input)

        # 3. Check output for leaked PII
        checked_output, _, output_risk = self.sensitive_check.scan(
            sanitized_input, llm_response
        )

        # 4. Deanonymize for user
        final_output = self.deanonymize.scan(sanitized_input, checked_output)[0]

        return final_output
```

## Testing

```python
def test_pii_redaction_in_logs():
    output = StringIO()
    structlog.configure(
        processors=[redact_pii, structlog.processors.JSONRenderer()],
        logger_factory=structlog.WriteLoggerFactory(file=output),
    )
    logger = structlog.get_logger()
    logger.info("test", email="test@example.com", ssn="123-45-6789")

    log_output = output.getvalue()
    assert "test@example.com" not in log_output
    assert "123-45-6789" not in log_output
    assert "[REDACTED_EMAIL]" in log_output
    assert "[REDACTED_SSN]" in log_output
```

**Incorrect — Sending raw prompts to Langfuse leaks PII to observability platform:**
```python
langfuse = Langfuse()
trace = langfuse.trace(
    input="My email is john@example.com and SSN is 123-45-6789"
)
# PII stored in Langfuse without redaction
```

**Correct — Mask callback automatically redacts PII before sending to Langfuse:**
```python
langfuse = Langfuse(mask=mask_pii)
trace = langfuse.trace(
    input="My email is john@example.com and SSN is 123-45-6789"
)
# Stored as: "My email is [REDACTED_EMAIL] and SSN is [REDACTED_SSN]"
```
