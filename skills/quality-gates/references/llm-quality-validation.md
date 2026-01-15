# LLM-as-Judge Quality Validation Reference

Modern AI workflows benefit from automated quality assessment using LLM-as-judge patterns.

---

## Quality Aspects to Evaluate

When validating LLM-generated content, evaluate these dimensions:

```python
QUALITY_ASPECTS = [
    "relevance",    # How relevant is the output to the input?
    "depth",        # How thorough and detailed is the analysis?
    "coherence",    # How well-structured and clear is the output?
    "accuracy",     # Are facts and code snippets correct?
    "completeness"  # Are all required sections present?
]
```

---

## Quality Gate Implementation Pattern

```python
async def quality_gate_node(state: WorkflowState) -> dict:
    """Validate output quality using LLM-as-judge."""
    THRESHOLD = 0.7  # Minimum score to pass (0.0-1.0)
    MAX_RETRIES = 2

    # Skip if no content to validate
    if not state.get("output"):
        return {"quality_gate_passed": True}

    # Evaluate each quality aspect
    scores = {}
    for aspect in QUALITY_ASPECTS:
        try:
            async with asyncio.timeout(30):  # Timeout protection
                score = await evaluate_aspect(
                    input_content=state["input"],
                    output_content=state["output"],
                    aspect=aspect
                )
                scores[aspect] = score
        except TimeoutError:
            scores[aspect] = 0.7  # Fail open with passing score

    # Calculate average (guard against division by zero)
    avg_score = sum(scores.values()) / len(scores) if scores else 0.0

    # Determine gate result
    retry_count = state.get("retry_count", 0)
    gate_passed = avg_score >= THRESHOLD or retry_count >= MAX_RETRIES

    return {
        "quality_scores": scores,
        "quality_gate_avg_score": avg_score,
        "quality_gate_passed": gate_passed,
        "quality_gate_retry_count": retry_count
    }
```

---

## Retry Logic

```python
def should_retry_synthesis(state: WorkflowState) -> str:
    """Conditional edge function for quality gate routing."""
    if state.get("quality_gate_passed", True):
        return "continue"  # Proceed to next node

    retry_count = state.get("quality_gate_retry_count", 0)
    if retry_count < MAX_RETRIES:
        return "retry_synthesis"  # Re-run synthesis

    return "continue"  # Max retries reached, fail open
```

---

## Fail-Open vs Fail-Closed

### Fail-Open (Recommended for most cases)
- If quality validation fails/errors, allow workflow to continue
- Log the failure for monitoring
- Prevents workflow from getting stuck
- Use when partial output is better than no output

### Fail-Closed (Use for critical paths)
- If validation fails, block the workflow
- Use for payment processing, security operations
- Requires explicit error handling and user notification

---

## Graceful Degradation Pattern

```python
async def safe_quality_evaluation(state: dict) -> dict:
    """Quality gate with full graceful degradation."""
    try:
        async with asyncio.timeout(60):  # Total timeout
            return await quality_gate_node(state)
    except TimeoutError:
        logger.warning("quality_gate_timeout", analysis_id=state["id"])
        return {
            "quality_gate_passed": True,  # Fail open
            "quality_gate_error": "Evaluation timed out"
        }
    except Exception as e:
        logger.error("quality_gate_error", error=str(e))
        return {
            "quality_gate_passed": True,  # Fail open
            "quality_gate_error": str(e)
        }
```

---

## Triple-Consumer Artifact Design

Modern artifacts should serve three distinct audiences:

### 1. AI Coding Assistants (Claude Code, Cursor, Copilot)
- **Need:** Structured context, implementation steps, code snippets
- **Format:** Pre-formatted prompts enabling accurate code generation
- **Quality check:** Are code snippets runnable? Are steps actionable?

### 2. Tutor Systems (Socratic learning)
- **Need:** Core concepts, exercises, quiz questions, mastery checklists
- **Format:** Pedagogical structure for progressive skill building
- **Quality check:** Do exercises have hints and solutions? Are quiz answers valid?

### 3. Human Readers (Developers, learners)
- **Need:** TL;DR, visual diagrams, glossary, clear explanations
- **Format:** Scannable in 10-30 seconds with deep-dive capability
- **Quality check:** Is summary under 500 chars? Do diagrams render correctly?

---

## Schema Validation for Multi-Consumer Output

```python
from pydantic import BaseModel, Field, model_validator

class QuizQuestion(BaseModel):
    """Quiz question with validated answer."""
    question: str = Field(min_length=10)
    options: list[str] = Field(min_length=2, max_length=6)
    correct_answer: str
    explanation: str = Field(min_length=20)

    @model_validator(mode='after')
    def validate_correct_answer(self) -> 'QuizQuestion':
        """Ensure correct_answer is one of the options."""
        if self.correct_answer not in self.options:
            raise ValueError(
                f"correct_answer '{self.correct_answer}' "
                f"must be one of {self.options}"
            )
        return self
```

---

## Quality Thresholds by Use Case

| Use Case | Threshold | Fail Mode | Max Retries |
|----------|-----------|-----------|-------------|
| Documentation | 0.6 | Open | 1 |
| Code Generation | 0.7 | Open | 2 |
| Test Generation | 0.7 | Open | 2 |
| Security Analysis | 0.8 | Closed | 3 |
| Payment/Finance | 0.9 | Closed | 3 |