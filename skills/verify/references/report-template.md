# Verification Report Template

```markdown
# Feature Verification Report
**Date**: [TODAY'S DATE]
**Branch**: [branch-name]
**Reviewer**: Claude Code with subagents

## Summary
[✅ READY FOR MERGE | ⚠️ NEEDS ATTENTION | ❌ BLOCKED]

## Code Quality
| Check | Status | Details |
|-------|--------|---------|
| Backend Lint (Ruff) | ✅/❌ | [errors] |
| Backend Types (ty) | ✅/❌ | [errors] |
| Frontend Format (Biome) | ✅/❌ | [errors] |
| Frontend Lint (ESLint) | ✅/❌ | [errors] |
| Frontend Types (tsc) | ✅/❌ | [errors] |

## Test Results
| Suite | Passed | Failed | Coverage |
|-------|--------|--------|----------|
| Backend Unit | X | Y | Z% |
| Frontend Unit | X | Y | Z% |
| E2E | X | Y | N/A |

## Security
| Check | Status | Issues |
|-------|--------|--------|
| Secrets Scan | ✅/❌ | [count] |
| npm audit | ✅/❌ | [high/critical] |
| pip-audit | ✅/❌ | [vulnerabilities] |
| OWASP Top 10 | ✅/❌ | [issues] |

## Best Practices Compliance
| Library | Status | Notes |
|---------|--------|-------|
| React 19 | ✅/⚠️ | [compliance notes] |
| FastAPI | ✅/⚠️ | [compliance notes] |
| LangGraph | ✅/⚠️ | [compliance notes] |
| TypeScript | ✅/⚠️ | [compliance notes] |

## Suggestions (Non-Blocking)
- [suggestion 1]
- [suggestion 2]

## Blockers (Must Fix)
- [blocker 1 if any]

## Evidence
- Backend tests: /tmp/backend_test_results.log
- Frontend tests: /tmp/frontend_test_results.log
- E2E screenshot: e2e-verification.png
```

## Status Definitions

| Status | Meaning |
|--------|---------|
| ✅ READY FOR MERGE | All checks pass, no blockers |
| ⚠️ NEEDS ATTENTION | Minor issues, review suggestions |
| ❌ BLOCKED | Critical issues, must fix before merge |

## Severity Levels

| Level | Action |
|-------|--------|
| Critical | Block merge immediately |
| High | Must fix before merge |
| Medium | Should fix, can merge with justification |
| Low | Nice to have, suggestions |
| Info | Informational only |