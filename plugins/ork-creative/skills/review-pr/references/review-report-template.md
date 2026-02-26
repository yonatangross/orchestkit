# Review Report Template

Use this template when synthesizing agent feedback in Phase 5:

```markdown
# PR Review: #$ARGUMENTS

## Summary
[1-2 sentence overview]

## Code Quality
| Area | Status | Notes |
|------|--------|-------|
| Readability | // | [notes] |
| Type Safety | // | [notes] |

## Test Adequacy
| Check | Status | Details |
|-------|--------|---------|
| Tests exist for changes | // | [X changed files have tests, Y do not] |
| Test types match changes | // | [e.g., API changes have integration tests] |
| Coverage gaps | // | [N untested paths] |
| Test quality | // | [meaningful assertions, no flaky patterns] |

**Verdict:** [ADEQUATE | GAPS (list) | MISSING (critical)]

## Security
| Check | Status |
|-------|--------|
| Secrets | / |
| Input Validation | / |
| Dependencies | / |

## Blockers (Must Fix)
- [if any]

## Suggestions (Non-Blocking)
- [improvements]
```
