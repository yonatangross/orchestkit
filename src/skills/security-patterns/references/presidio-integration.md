# Microsoft Presidio Integration

Enterprise-grade PII detection and anonymization with Microsoft Presidio.

## Installation

```bash
pip install presidio-analyzer presidio-anonymizer
python -m spacy download en_core_web_lg
```

## Basic Usage

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

# Initialize engines (singleton recommended)
analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

def detect_pii(text: str, language: str = "en") -> list:
    """Detect PII entities in text."""
    return analyzer.analyze(
        text=text,
        language=language,
        entities=["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER", "CREDIT_CARD", "US_SSN"]
    )

def anonymize_text(text: str, language: str = "en") -> str:
    """Detect and anonymize PII in text."""
    results = analyzer.analyze(text=text, language=language)
    return anonymizer.anonymize(text=text, analyzer_results=results).text
```

## Custom Operators

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

## References

- [Presidio Documentation](https://microsoft.github.io/presidio/)
- [Supported Entities](https://microsoft.github.io/presidio/supported_entities/)
