# Gibberish Detection

Detect degraded or nonsensical LLM outputs using perplexity and semantic analysis.

## Perplexity-Based Detection

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

class PerplexityDetector:
    """Detect gibberish using perplexity scores."""

    def __init__(self, model_name: str = "gpt2", threshold: float = 100.0):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(model_name)
        self.threshold = threshold

    def calculate_perplexity(self, text: str) -> float:
        inputs = self.tokenizer(text, return_tensors="pt")
        with torch.no_grad():
            outputs = self.model(**inputs, labels=inputs["input_ids"])
        return torch.exp(outputs.loss).item()

    def is_gibberish(self, text: str) -> dict:
        perplexity = self.calculate_perplexity(text)
        return {
            "perplexity": perplexity,
            "is_gibberish": perplexity > self.threshold,
            "severity": "high" if perplexity > 1000 else "medium" if perplexity > self.threshold else "low"
        }
```

## Pattern-Based Detection

```python
import re
import math
from collections import Counter

class PatternGibberishDetector:
    def __init__(self):
        self.patterns = [
            (r'(.)\1{4,}', "Repeated characters"),
            (r'\b(\w+)\s+\1\b', "Repeated words"),
            (r'[^\w\s]{5,}', "Excessive punctuation"),
        ]

    def check(self, text: str) -> dict:
        issues = []
        for pattern, desc in self.patterns:
            if re.search(pattern, text):
                issues.append(desc)

        entropy = self._entropy(text)
        if entropy < 2.0:
            issues.append("Low entropy")
        elif entropy > 5.0:
            issues.append("High entropy")

        return {"issues": issues, "is_gibberish": len(issues) > 0}

    def _entropy(self, text: str) -> float:
        freq = Counter(text.lower())
        total = len(text)
        return -sum((c/total) * math.log2(c/total) for c in freq.values() if c > 0)
```

## References

- [Perplexity for LLM Evaluation](https://www.analyticsvidhya.com/blog/2025/04/perplexity-metric-for-llm-evaluation/)
- [ZEDD: Zero-Shot Embedding Drift Detection](https://arxiv.org/html/2601.12359)
