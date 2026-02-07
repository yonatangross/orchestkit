---
name: pii-masking-patterns
description: PII detection and masking for LLM observability. Use when logging prompts/responses, tracing with Langfuse, or protecting sensitive data in production LLM pipelines.
context: fork
agent: monitoring-engineer
version: 1.0.0
author: OrchestKit
tags: [pii, masking, privacy, security, langfuse, presidio, gdpr]
user-invocable: false
complexity: low
---

# PII Masking Patterns

Protect sensitive data in LLM observability pipelines with automated PII detection and redaction.

## Overview

- Masking PII before logging prompts and responses
- Integrating with Langfuse tracing via mask callbacks
- Using Microsoft Presidio for enterprise-grade detection
- Implementing LLM Guard for input/output sanitization
- Pre-logging redaction with structlog/loguru

## Quick Reference

### Langfuse Mask Callback (Recommended)

```python
import re
from langfuse import Langfuse

def mask_pii(data, **kwargs):
    """Mask PII before sending to Langfuse."""
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

# Initialize with masking
langfuse = Langfuse(mask=mask_pii)
```

### Microsoft Presidio Pipeline

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

def anonymize_text(text: str, language: str = "en") -> str:
    """Detect and anonymize PII using Presidio."""
    results = analyzer.analyze(text=text, language=language)
    anonymized = anonymizer.anonymize(text=text, analyzer_results=results)
    return anonymized.text
```

### LLM Guard Sanitization

```python
from llm_guard.input_scanners import Anonymize
from llm_guard.output_scanners import Sensitive
from llm_guard.vault import Vault

vault = Vault()  # Stores original values for deanonymization

# Input sanitization
input_scanner = Anonymize(vault, preamble="", language="en")
sanitized_prompt, is_valid, risk_score = input_scanner.scan(prompt)

# Output sanitization
output_scanner = Sensitive(entity_types=["PERSON", "EMAIL"], redact=True)
sanitized_output, is_valid, risk_score = output_scanner.scan(prompt, response)
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Detection engine | Presidio (enterprise), regex (simple), LLM Guard (LLM pipelines) |
| Masking strategy | Replace with type tokens `[REDACTED_EMAIL]` for debuggability |
| Performance | Use async/batch processing for high-throughput |
| Langfuse integration | Use `mask=` callback at client initialization |
| Reversibility | Use LLM Guard Vault for deanonymization when needed |

## Anti-Patterns

```python
# ❌ NEVER log raw PII
logger.info(f"User email: {user.email}")  # PII leakage!

# ❌ NEVER send unmasked data to observability
langfuse.trace(input=raw_prompt)  # May contain PII!

# ✅ ALWAYS mask before logging
logger.info(f"User email: {mask_email(user.email)}")

# ✅ ALWAYS use mask callback
langfuse = Langfuse(mask=mask_pii)
```

## Detailed Documentation

| Resource | Description |
|----------|-------------|
| [references/presidio-integration.md](references/presidio-integration.md) | Microsoft Presidio setup, custom recognizers, batch processing |
| [references/langfuse-mask-callback.md](references/langfuse-mask-callback.md) | Langfuse SDK mask implementation patterns |
| [references/llm-guard-sanitization.md](references/llm-guard-sanitization.md) | LLM Guard Anonymize/Deanonymize with Vault |
| [references/logging-redaction.md](references/logging-redaction.md) | structlog/loguru pre-logging patterns |
| [checklists/pii-masking-setup-checklist.md](checklists/pii-masking-setup-checklist.md) | Implementation checklist |

## Related Skills

- `langfuse-observability` - Tracing with PII masking integration
- `defense-in-depth` - Security layer including data protection
- `advanced-guardrails` - LLM safety guardrails
- `input-validation` - Input sanitization patterns

## Capability Details

### langfuse-masking
**Keywords:** langfuse mask, trace masking, observability pii, mask callback
**Solves:**
- Mask PII in Langfuse traces
- Protect sensitive data in LLM observability
- GDPR compliance for LLM logging

### presidio-detection
**Keywords:** presidio, pii detection, microsoft presidio, named entity, ner
**Solves:**
- Detect PII using NLP models
- Custom entity recognizers
- Enterprise-grade PII detection

### llm-guard-anonymization
**Keywords:** llm guard, anonymize, deanonymize, vault, sanitize
**Solves:**
- Sanitize LLM inputs and outputs
- Reversible anonymization with Vault
- Input/output scanner pipeline

### regex-masking
**Keywords:** regex, pattern matching, email mask, phone mask, ssn mask
**Solves:**
- Simple pattern-based PII masking
- Lightweight masking without ML
- Custom pattern detection

### logging-redaction
**Keywords:** structlog, loguru, logging, redact, pre-logging
**Solves:**
- Redact PII before logging
- Structured logging with masking
- Log processor patterns
