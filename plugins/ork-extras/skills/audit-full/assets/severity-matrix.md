# Severity Classification Matrix

Consistent severity scoring across all audit domains.

## Classification Criteria

| Severity | Exploitability | Impact | Examples |
|----------|---------------|--------|----------|
| CRITICAL | No auth required, automated | Data breach, RCE, full compromise | SQL injection in public endpoint, hardcoded admin creds |
| HIGH | Low-privilege access needed | Privilege escalation, data leak | IDOR, auth bypass, missing rate limits on auth |
| MEDIUM | Specific conditions required | Limited data exposure, DoS | XSS requiring user interaction, information disclosure |
| LOW | Theoretical or defense-in-depth | Minimal direct impact | Missing security headers, verbose errors, weak CSP |

## Security Domain

| Finding Type | Default Severity | Upgrade If | Downgrade If |
|-------------|-----------------|------------|--------------|
| SQL injection | CRITICAL | Public endpoint | Internal-only, parameterized nearby |
| Command injection | CRITICAL | User input flows to exec | Hardcoded commands only |
| Auth bypass | HIGH | Admin routes affected | Low-privilege routes only |
| XSS (stored) | HIGH | In admin panel | In user-only content |
| XSS (reflected) | MEDIUM | No CSP headers | Strong CSP in place |
| SSRF | HIGH | Internal network access | URL whitelist exists |
| Hardcoded secrets | HIGH | Production credentials | Example/test values |
| Missing rate limiting | MEDIUM | Auth endpoints | Static content endpoints |
| Verbose error messages | LOW | Stack traces exposed | Generic messages |
| Missing security headers | LOW | No HTTPS | HTTPS + some headers |

## Architecture Domain

| Finding Type | Default Severity | Upgrade If | Downgrade If |
|-------------|-----------------|------------|--------------|
| Circular dependency | MEDIUM | > 3 files in cycle | 2 files, easy to break |
| Layer violation | MEDIUM | Domain → Infrastructure | Utils shared across layers |
| God module (>500 LOC) | MEDIUM | > 1000 LOC, growing | Stable, well-tested |
| No error handling pattern | HIGH | Inconsistent across API | Internal utilities |
| Mixed data access patterns | MEDIUM | ORM + raw SQL in same service | Legacy migration in progress |
| No dependency injection | LOW | Tight coupling everywhere | Only in entry points |
| Missing interfaces | LOW | Between major modules | Within single module |

## Dependency Domain

| Finding Type | Default Severity | Upgrade If | Downgrade If |
|-------------|-----------------|------------|--------------|
| Known CVE (CVSS 9+) | CRITICAL | Exploitable in your usage | Not reachable in code path |
| Known CVE (CVSS 7-8.9) | HIGH | In production deps | In dev-only deps |
| GPL in proprietary code | CRITICAL | Runtime dependency | Dev tooling only |
| Unmaintained (2+ years) | MEDIUM | Security-sensitive package | Stable utility |
| 2+ major versions behind | MEDIUM | Framework or auth library | Utility library |
| Unused dependency | LOW | Large package (>1MB) | Small utility |

## Scoring Formula

```
Health Score = 10 - (CRITICAL × 2) - (HIGH × 1) - (MEDIUM × 0.3) - (LOW × 0.1)
Minimum: 0, Maximum: 10
```

| Score | Grade | Interpretation |
|-------|-------|---------------|
| 9-10 | A | Excellent — minor improvements only |
| 7-8 | B | Good — some issues to address |
| 5-6 | C | Fair — significant work needed |
| 3-4 | D | Poor — critical issues present |
| 0-2 | F | Failing — immediate action required |
