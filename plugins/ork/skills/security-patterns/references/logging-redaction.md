# Logging Redaction Patterns

Pre-logging PII redaction with structlog and loguru.

## Structlog Processor

```python
import re
import structlog
from typing import Any

# Pre-compile patterns
PII_PATTERNS = {
    "email": re.compile(r'\b[\w.-]+@[\w.-]+\.\w{2,}\b'),
    "phone": re.compile(r'\b(?:\+1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b'),
    "ssn": re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
    "credit_card": re.compile(r'\b(?:\d[ -]*?){13,19}\b'),
    "ip": re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b'),
}

def redact_pii(logger, method_name: str, event_dict: dict) -> dict:
    """
    Structlog processor to redact PII from all log fields.
    """
    def redact_value(value: Any) -> Any:
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


# Configure structlog with PII redaction
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        redact_pii,  # Add PII redaction processor
        structlog.processors.JSONRenderer()
    ]
)

logger = structlog.get_logger()

# Usage - PII is automatically redacted
logger.info(
    "user_registered",
    email="john@example.com",  # -> [REDACTED_EMAIL]
    phone="555-123-4567"       # -> [REDACTED_PHONE]
)
```

## Structlog with Presidio

```python
import structlog
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

# Singleton Presidio engines
_analyzer = None
_anonymizer = None

def get_presidio_engines():
    global _analyzer, _anonymizer
    if _analyzer is None:
        _analyzer = AnalyzerEngine()
        _anonymizer = AnonymizerEngine()
    return _analyzer, _anonymizer

def presidio_redact_processor(logger, method_name: str, event_dict: dict) -> dict:
    """Use Presidio for enterprise-grade PII redaction in logs."""
    analyzer, anonymizer = get_presidio_engines()

    def redact_value(value):
        if isinstance(value, str) and len(value) > 5:
            try:
                results = analyzer.analyze(text=value, language="en")
                if results:
                    anonymized = anonymizer.anonymize(
                        text=value,
                        analyzer_results=results
                    )
                    return anonymized.text
            except Exception:
                pass  # Fallback to original on error
        elif isinstance(value, dict):
            return {k: redact_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [redact_value(item) for item in value]
        return value

    return {k: redact_value(v) for k, v in event_dict.items()}

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        presidio_redact_processor,
        structlog.processors.JSONRenderer()
    ]
)
```

## Loguru Filter

```python
import re
from loguru import logger

PII_PATTERNS = {
    "email": re.compile(r'\b[\w.-]+@[\w.-]+\.\w{2,}\b'),
    "phone": re.compile(r'\b(?:\+1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b'),
    "ssn": re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
    "credit_card": re.compile(r'\b(?:\d[ -]*?){13,19}\b'),
}

def pii_filter(record):
    """Loguru filter to redact PII from log messages."""
    message = record["message"]
    for entity_type, pattern in PII_PATTERNS.items():
        message = pattern.sub(f'[REDACTED_{entity_type.upper()}]', message)
    record["message"] = message
    return True

# Configure loguru with PII filter
logger.remove()  # Remove default handler
logger.add(
    "logs/app.log",
    filter=pii_filter,
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
    serialize=True  # JSON format
)

# Usage
logger.info("User john@example.com logged in from 192.168.1.1")
# Output: "User [REDACTED_EMAIL] logged in from [REDACTED_IP]"
```

## Loguru with Custom Patcher

```python
from loguru import logger

def pii_patcher(record):
    """Patch record to redact PII in extra fields."""
    if "extra" in record:
        for key, value in record["extra"].items():
            if isinstance(value, str):
                for entity_type, pattern in PII_PATTERNS.items():
                    value = pattern.sub(f'[REDACTED_{entity_type.upper()}]', value)
                record["extra"][key] = value
    return record

logger = logger.patch(pii_patcher)

# Usage with bound variables
logger.bind(user_email="jane@example.com").info("Processing user request")
# The email in extra will be redacted
```

## Field-Specific Redaction

```python
import structlog
from typing import Any

# Fields that should always be redacted
SENSITIVE_FIELDS = {
    "email", "phone", "ssn", "credit_card", "password",
    "api_key", "token", "secret", "authorization"
}

# Fields that should be partially masked
PARTIAL_MASK_FIELDS = {
    "user_id": lambda v: f"{str(v)[:4]}...{str(v)[-4:]}" if len(str(v)) > 8 else "***"
}

def smart_redact_processor(logger, method_name: str, event_dict: dict) -> dict:
    """Smart redaction based on field names."""
    result = {}

    for key, value in event_dict.items():
        key_lower = key.lower()

        # Full redaction for sensitive fields
        if key_lower in SENSITIVE_FIELDS:
            result[key] = "[REDACTED]"

        # Partial masking
        elif key_lower in PARTIAL_MASK_FIELDS:
            result[key] = PARTIAL_MASK_FIELDS[key_lower](value)

        # Pattern-based redaction for other string fields
        elif isinstance(value, str):
            result[key] = redact_pii_patterns(value)

        else:
            result[key] = value

    return result

def redact_pii_patterns(value: str) -> str:
    """Apply PII patterns to a string."""
    for entity_type, pattern in PII_PATTERNS.items():
        value = pattern.sub(f'[REDACTED_{entity_type.upper()}]', value)
    return value
```

## Context Manager for Sensitive Operations

```python
import structlog
from contextlib import contextmanager

@contextmanager
def sensitive_logging_context():
    """
    Context manager that increases redaction sensitivity.
    """
    # Bind a flag to indicate we're in a sensitive context
    token = structlog.contextvars.bind_contextvars(
        _sensitive_context=True
    )
    try:
        yield
    finally:
        structlog.contextvars.unbind_contextvars("_sensitive_context")

def enhanced_redact_processor(logger, method_name: str, event_dict: dict) -> dict:
    """Enhanced redaction in sensitive contexts."""
    is_sensitive = event_dict.pop("_sensitive_context", False)

    if is_sensitive:
        # In sensitive context, redact everything that looks like data
        for key, value in event_dict.items():
            if isinstance(value, str) and len(value) > 3:
                event_dict[key] = "[REDACTED_SENSITIVE]"
    else:
        # Normal PII redaction
        event_dict = redact_pii(logger, method_name, event_dict)

    return event_dict

# Usage
logger = structlog.get_logger()

with sensitive_logging_context():
    logger.info("processing_payment", card="4111111111111111")
    # Everything is redacted in this context
```

## Testing Log Redaction

```python
import pytest
import structlog
from io import StringIO

def test_pii_redaction_in_logs():
    """Verify PII is redacted from logs."""
    output = StringIO()

    structlog.configure(
        processors=[
            redact_pii,
            structlog.processors.JSONRenderer()
        ],
        logger_factory=structlog.WriteLoggerFactory(file=output)
    )

    logger = structlog.get_logger()
    logger.info("test", email="test@example.com", ssn="123-45-6789")

    log_output = output.getvalue()

    assert "test@example.com" not in log_output
    assert "123-45-6789" not in log_output
    assert "[REDACTED_EMAIL]" in log_output
    assert "[REDACTED_SSN]" in log_output
```

## References

- [Structlog Documentation](https://www.structlog.org/en/stable/)
- [Loguru Documentation](https://loguru.readthedocs.io/en/stable/)
- [Structlog Processors Guide](https://www.structlog.org/en/stable/processors.html)
