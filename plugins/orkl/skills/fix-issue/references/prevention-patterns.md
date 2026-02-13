# Prevention Patterns

Strategies to prevent issue recurrence by category.

## Code-Level Prevention

| Issue Type | Prevention Pattern |
|------------|-------------------|
| Null/undefined | Optional chaining, nullish coalescing |
| Type errors | Strict TypeScript, runtime validation |
| Input validation | Zod schemas at boundaries |
| Error handling | Result types, explicit error states |
| Race conditions | Locks, atomic operations, idempotency |
| Memory leaks | Cleanup in useEffect, WeakRef |

```typescript
// Before: Vulnerable
const name = user.profile.name;

// After: Defensive
const name = user?.profile?.name ?? 'Unknown';
```

## Architecture-Level Prevention

| Issue Type | Prevention Pattern |
|------------|-------------------|
| Cascading failures | Circuit breakers |
| Network instability | Retry with backoff |
| Data inconsistency | Transactions, saga pattern |
| Timeout issues | Request deadlines, cancellation |
| Resource exhaustion | Rate limiting, pooling |

```python
# Circuit breaker example
@circuit_breaker(failure_threshold=5, recovery_timeout=30)
async def external_api_call():
    ...
```

## Process-Level Prevention

| Issue Type | Prevention Pattern |
|------------|-------------------|
| Logic errors | Mandatory PR review |
| Missing tests | Coverage requirements (>80%) |
| Regression | Required regression test before fix |
| Knowledge gaps | ADR for decisions |
| Onboarding issues | Runbook documentation |

## Tooling-Level Prevention

| Issue Type | Prevention Pattern |
|------------|-------------------|
| Style issues | ESLint/Ruff rules |
| Type errors | Pre-commit type check |
| Security vulnerabilities | Dependency scanning in CI |
| Format inconsistency | Auto-format on save |
| Secrets in code | Pre-commit secret detection |

```yaml
# .pre-commit-config.yaml
- repo: local
  hooks:
    - id: type-check
      name: TypeScript check
      entry: npx tsc --noEmit
      language: system
```

## Prevention Priority Matrix

| Effort | Impact | Priority |
|--------|--------|----------|
| Low | High | Immediate |
| Low | Low | Backlog |
| High | High | Sprint planning |
| High | Low | Skip |
