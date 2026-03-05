---
paths:
  - "tests/**"
  - "src/hooks/src/__tests__/**"
---

# Test Conventions

## File Organization
- Shell tests: `tests/<category>/test-*.sh` (uses shared/_lib/common.sh)
- Unit tests: `tests/unit/*.js` (vitest)
- Hook tests: `src/hooks/src/__tests__/**/*.test.ts`
- Eval tests: `tests/evals/**/*.yaml`

## Principles
- Never weaken an existing test to make it pass — fix the code instead
- Security tests block push — never skip with `--no-verify`
- Golden eval tests are ground truth — add new tests, don't modify old ones
