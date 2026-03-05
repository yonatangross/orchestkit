---
paths:
  - "tests/evals/**"
---

# Eval & Golden Test Rules

- Golden tests are GROUND TRUTH — modify with extreme care
- Each `.yaml` eval needs: `prompt`, `expected_behavior`, `grader_type`
- Never weaken an existing golden test to make it pass — fix the code
- Add new tests for new capabilities, don't modify old ones
- Eval format follows unified spec in `tests/evals/README.md`
