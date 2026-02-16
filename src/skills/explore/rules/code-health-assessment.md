---
title: Code Health Assessment
impact: MEDIUM
impactDescription: "Provides structured code quality scoring across five key dimensions"
tags: code-health, assessment, metrics
---

# Code Health Assessment

Rate found code quality 0-10 with specific dimensions. See [code-health-rubric.md](../references/code-health-rubric.md) for scoring criteria.

```python
Task(
  subagent_type="code-quality-reviewer",
  prompt="""CODE HEALTH ASSESSMENT for files related to: $ARGUMENTS

  Rate each dimension 0-10:

  1. READABILITY (0-10)
     - Clear naming conventions?
     - Appropriate comments?
     - Logical organization?

  2. MAINTAINABILITY (0-10)
     - Single responsibility?
     - Low coupling?
     - Easy to modify?

  3. TESTABILITY (0-10)
     - Pure functions where possible?
     - Dependency injection?
     - Existing test coverage?

  4. COMPLEXITY (0-10, inverted: 10=simple, 0=complex)
     - Cyclomatic complexity?
     - Nesting depth?
     - Function length?

  5. DOCUMENTATION (0-10)
     - API docs present?
     - Usage examples?
     - Architecture notes?

  Output:
  {
    "overall_score": N.N,
    "dimensions": {
      "readability": N,
      "maintainability": N,
      "testability": N,
      "complexity": N,
      "documentation": N
    },
    "hotspots": ["file:line - issue"],
    "recommendations": ["improvement suggestion"]
  }

  SUMMARY: End with: "HEALTH: [N.N]/10 - [best dimension] strong, [worst dimension] needs work"
  """,
  run_in_background=True,
  max_turns=25
)
```

**Incorrect — Vague code quality feedback:**
```markdown
Code Review: The code looks okay. Some parts are complex.
Maybe add more tests.
```

**Correct — Structured health assessment with scores:**
```json
{
  "overall_score": 6.2,
  "dimensions": {
    "readability": 8,
    "maintainability": 5,
    "testability": 4,
    "complexity": 6,
    "documentation": 8
  },
  "hotspots": [
    "auth.ts:45 - nested if/else 5 levels deep",
    "utils.ts:120 - 200-line function, no SRP"
  ],
  "recommendations": [
    "Extract auth.ts:45-80 to separate validation functions",
    "Add unit tests for utils.ts edge cases"
  ]
}
```
```
