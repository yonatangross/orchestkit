---
title: Configure an AI code review agent for prompt injection and token limit checks
impact: MEDIUM
impactDescription: "Optional 7th reviewer agent for AI/ML code covering prompt injection and token limits"
tags: ai-review, code-review, agent
---

# AI Code Review Agent (Optional)

If PR includes AI/ML code, add a 7th agent:

```python
Task(
  description="Review LLM integration",
  subagent_type="llm-integrator",
  prompt="""LLM CODE REVIEW for PR $ARGUMENTS

  Review AI/LLM integration:
  1. Prompt injection prevention
  2. Token limit handling
  3. Caching strategy
  4. Error handling and fallbacks

  SUMMARY: End with: "RESULT: [PASS|WARN|FAIL] - [N] LLM issues: [key concern]"
  """,
  run_in_background=True,
  max_turns=25
)
```

**Incorrect — Missing LLM review for AI code:**
```python
# PR modifies prompt.py but no LLM reviewer
Task(subagent_type="code-quality-reviewer", ...)
Task(subagent_type="security-auditor", ...)
# Missing: LLM-specific review
```

**Correct — Add LLM reviewer for AI code:**
```python
# Detect AI/ML changes, add specialized reviewer
if pr_contains_llm_code:
    Task(subagent_type="llm-integrator", prompt="LLM CODE REVIEW...", run_in_background=True)
```
