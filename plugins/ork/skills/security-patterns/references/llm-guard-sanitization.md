# LLM Guard Sanitization

Input/output sanitization for LLM pipelines using LLM Guard's Anonymize and Deanonymize scanners.

## Installation

```bash
pip install llm-guard
python -m spacy download en_core_web_trf  # High-accuracy model
```

## Basic Input Sanitization

```python
from llm_guard.input_scanners import Anonymize
from llm_guard.input_scanners.anonymize_helpers import BERT_LARGE_NER_CONF
from llm_guard.vault import Vault

# Vault stores original values for deanonymization
vault = Vault()

# Initialize scanner with configuration
scanner = Anonymize(
    vault=vault,
    preamble="",  # Text prepended to sanitized output
    allowed_names=["John Doe"],  # Names to NOT anonymize
    hidden_names=["Acme Corp"],  # Always anonymize these
    recognizer_conf=BERT_LARGE_NER_CONF,
    language="en"
)

def sanitize_input(prompt: str) -> tuple[str, bool, float]:
    """
    Sanitize user input before sending to LLM.

    Returns:
        (sanitized_prompt, is_valid, risk_score)
    """
    sanitized_prompt, is_valid, risk_score = scanner.scan(prompt)
    return sanitized_prompt, is_valid, risk_score

# Usage
prompt = "My name is Jane Smith and my email is jane@company.com"
sanitized, valid, risk = sanitize_input(prompt)
# Result: "My name is [REDACTED_PERSON_1] and my email is [REDACTED_EMAIL_1]"
```

## Output Deanonymization

```python
from llm_guard.output_scanners import Deanonymize

# Use the same vault from input sanitization
deanonymize_scanner = Deanonymize(vault=vault)

def deanonymize_output(sanitized_prompt: str, model_output: str) -> str:
    """
    Restore original values in model output.

    Args:
        sanitized_prompt: The prompt that was sent to the LLM
        model_output: The LLM's response

    Returns:
        Output with original values restored
    """
    restored_output, is_valid, risk_score = deanonymize_scanner.scan(
        sanitized_prompt,
        model_output
    )
    return restored_output

# Example flow
original_prompt = "Schedule a meeting with Jane Smith at jane@company.com"
sanitized_prompt, _, _ = scanner.scan(original_prompt)
# sanitized_prompt = "Schedule a meeting with [PERSON_1] at [EMAIL_1]"

llm_response = await llm.generate(sanitized_prompt)
# llm_response = "Meeting scheduled with [PERSON_1]. Confirmation sent to [EMAIL_1]."

final_response = deanonymize_output(sanitized_prompt, llm_response)
# final_response = "Meeting scheduled with Jane Smith. Confirmation sent to jane@company.com."
```

## Output Sensitive Data Detection

```python
from llm_guard.output_scanners import Sensitive

# Detect PII in LLM outputs (without prior anonymization)
sensitive_scanner = Sensitive(
    entity_types=["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "CREDIT_CARD"],
    redact=True,  # Replace detected PII with [REDACTED]
    threshold=0.5  # Confidence threshold (0-1)
)

def check_output_for_pii(prompt: str, output: str) -> tuple[str, bool, float]:
    """
    Check LLM output for leaked PII.

    Returns:
        (sanitized_output, is_valid, risk_score)
    """
    sanitized_output, is_valid, risk_score = sensitive_scanner.scan(prompt, output)
    return sanitized_output, is_valid, risk_score
```

## Full Pipeline Integration

```python
from llm_guard.input_scanners import Anonymize
from llm_guard.output_scanners import Deanonymize, Sensitive
from llm_guard.vault import Vault
from langfuse.decorators import observe, langfuse_context

class SecureLLMPipeline:
    def __init__(self):
        self.vault = Vault()
        self.anonymize = Anonymize(vault=self.vault, language="en")
        self.deanonymize = Deanonymize(vault=self.vault)
        self.sensitive_check = Sensitive(redact=True)

    @observe(name="secure_llm_call")
    async def process(self, user_input: str) -> str:
        """Secure LLM pipeline with full PII protection."""

        # Step 1: Anonymize input
        sanitized_input, input_valid, input_risk = self.anonymize.scan(user_input)

        langfuse_context.update_current_observation(
            metadata={
                "input_risk_score": input_risk,
                "pii_detected_in_input": not input_valid
            }
        )

        # Step 2: Call LLM with sanitized input
        llm_response = await self.llm.generate(sanitized_input)

        # Step 3: Check output for leaked PII
        checked_output, output_valid, output_risk = self.sensitive_check.scan(
            sanitized_input,
            llm_response
        )

        # Step 4: Deanonymize for user (restore original names)
        final_output = self.deanonymize.scan(sanitized_input, checked_output)[0]

        langfuse_context.update_current_observation(
            metadata={
                "output_risk_score": output_risk,
                "pii_leaked_in_output": not output_valid
            }
        )

        return final_output
```

## Configuration Options

### Anonymize Scanner

```python
from llm_guard.input_scanners import Anonymize
from llm_guard.input_scanners.anonymize_helpers import (
    BERT_LARGE_NER_CONF,
    BERT_BASE_NER_CONF,
    DISTILBERT_NER_CONF
)

scanner = Anonymize(
    vault=vault,
    preamble="",                          # Prepend to output
    allowed_names=["Claude", "GPT"],      # Don't anonymize these
    hidden_names=["Internal Corp"],       # Always anonymize these
    entity_types=[                        # Entities to detect
        "PERSON",
        "EMAIL_ADDRESS",
        "PHONE_NUMBER",
        "CREDIT_CARD",
        "US_SSN",
        "IP_ADDRESS",
        "LOCATION"
    ],
    use_faker=True,                       # Replace with fake data
    recognizer_conf=BERT_LARGE_NER_CONF,  # NER model config
    threshold=0.5,                        # Confidence threshold
    language="en"                         # Language
)
```

### Recognizer Configurations

| Config | Model | Speed | Accuracy |
|--------|-------|-------|----------|
| BERT_LARGE_NER_CONF | bert-large | Slow | Highest |
| BERT_BASE_NER_CONF | bert-base | Medium | High |
| DISTILBERT_NER_CONF | distilbert | Fast | Good |

## Handling Overlapping Entities

LLM Guard handles overlapping entities automatically:

```python
# Input: "Contact John Smith at john.smith@example.com"
# PERSON: "John Smith" (indices 8-18)
# EMAIL: "john.smith@example.com" (indices 22-45)
# - john.smith overlaps with PERSON

# LLM Guard prioritizes:
# 1. Higher confidence score wins
# 2. Longer span wins if scores equal
```

## Testing

```python
import pytest
from llm_guard.input_scanners import Anonymize
from llm_guard.vault import Vault

def test_anonymization():
    vault = Vault()
    scanner = Anonymize(vault=vault)

    test_input = "Contact John at john@example.com or 555-123-4567"
    sanitized, is_valid, risk = scanner.scan(test_input)

    # Verify PII is removed
    assert "John" not in sanitized
    assert "john@example.com" not in sanitized
    assert "555-123-4567" not in sanitized

    # Verify placeholders are present
    assert "[PERSON" in sanitized or "REDACTED" in sanitized

def test_deanonymization():
    vault = Vault()
    anonymize = Anonymize(vault=vault)
    deanonymize = Deanonymize(vault=vault)

    original = "Send email to Alice"
    sanitized, _, _ = anonymize.scan(original)

    # Simulate LLM response
    response = f"Email sent to {sanitized.split()[-1]}"

    restored, _, _ = deanonymize.scan(sanitized, response)
    assert "Alice" in restored
```

## References

- [LLM Guard Documentation](https://protectai.github.io/llm-guard/)
- [Anonymize Scanner](https://protectai.github.io/llm-guard/input_scanners/anonymize/)
- [Sensitive Scanner](https://protectai.github.io/llm-guard/output_scanners/sensitive/)
- [LLM Guard GitHub](https://github.com/protectai/llm-guard)
