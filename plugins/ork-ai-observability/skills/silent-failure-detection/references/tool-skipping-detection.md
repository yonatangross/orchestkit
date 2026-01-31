# Tool Skipping Detection

Detect when agents skip expected tool calls - a common silent failure pattern.

## Basic Detector

```python
from dataclasses import dataclass, field
from typing import Set, Dict, List
from langfuse.decorators import observe, langfuse_context

@dataclass
class ToolExpectation:
    task_pattern: str
    required_tools: Set[str]
    min_tool_calls: int = 1

class ToolSkippingDetector:
    """Detect when agents skip expected tool calls."""

    def __init__(self):
        self.expectations: Dict[str, ToolExpectation] = {}

    def register_expectation(self, task_type: str, required_tools: Set[str], min_calls: int = 1):
        self.expectations[task_type] = ToolExpectation(task_type, required_tools, min_calls)

    @observe(name="tool_skipping_check")
    def check(self, task_type: str, tools_called: Set[str], response: str = "") -> dict:
        if task_type not in self.expectations:
            return {"status": "no_expectation"}

        exp = self.expectations[task_type]
        missing = exp.required_tools - tools_called
        insufficient = len(tools_called) < exp.min_tool_calls
        hints = self._detect_hallucination(response, missing)

        result = {
            "missing_required": list(missing),
            "skipping_detected": bool(missing) or insufficient,
            "hallucination_hints": hints
        }

        if result["skipping_detected"]:
            langfuse_context.score(name="tool_skipping", value=1.0, comment=f"Missing: {missing}")

        return result

    def _detect_hallucination(self, text: str, missing: Set[str]) -> List[str]:
        hints = []
        phrases = ["I believe", "I think", "probably", "from my knowledge"]
        for p in phrases:
            if p.lower() in text.lower():
                hints.append(f"Uncertainty phrase: '{p}'")
        if "search" in missing and "search shows" in text.lower():
            hints.append("Claims search without calling search tool")
        return hints
```

## Default Configuration

```python
def create_default_detector() -> ToolSkippingDetector:
    detector = ToolSkippingDetector()
    detector.register_expectation("question_answering", {"search", "read"}, min_calls=1)
    detector.register_expectation("code_generation", {"read"}, min_calls=1)
    detector.register_expectation("data_analysis", {"query_database", "read"}, min_calls=2)
    return detector
```

## References

- [AnythingLLM - Agent Not Using Tools](https://docs.anythingllm.com/agent-not-using-tools)
- [Tool Use Monitoring](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use)
