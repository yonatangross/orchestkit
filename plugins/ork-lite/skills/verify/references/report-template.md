# Verification Report Template

Copy this template and fill in results from parallel agent verification.

## Quick Copy Template

```markdown
# Feature Verification Report

**Date**: [TODAY'S DATE]
**Branch**: [branch-name]
**Feature**: [feature description]
**Reviewer**: Claude Code with 5 parallel subagents
**Verification Duration**: [X minutes]

---

## Summary

**Status**: [READY FOR MERGE | NEEDS ATTENTION | BLOCKED]

[1-2 sentence summary of verification results]

---

## Agent Results

### 1. Code Quality (code-quality-reviewer)

| Check | Tool | Exit Code | Errors | Warnings | Status |
|-------|------|-----------|--------|----------|--------|
| Backend Lint | Ruff | 0/1 | N | N | PASS/FAIL |
| Backend Types | ty | 0/1 | N | N | PASS/FAIL |
| Frontend Lint | Biome | 0/1 | N | N | PASS/FAIL |
| Frontend Types | tsc | 0/1 | N | N | PASS/FAIL |

**Pattern Compliance:**
- [ ] No `console.log` in production code
- [ ] No `any` types in TypeScript
- [ ] Exhaustive switches with `assertNever`
- [ ] SOLID principles followed
- [ ] Cyclomatic complexity < 10

**Findings:**
- [List any pattern violations]

---

### 2. Security Audit (security-auditor)

| Check | Tool | Critical | High | Medium | Low | Status |
|-------|------|----------|------|--------|-----|--------|
| JS Dependencies | npm audit | N | N | N | N | PASS/BLOCK |
| Python Dependencies | pip-audit | N | N | N | N | PASS/BLOCK |
| Secrets Scan | grep/gitleaks | N/A | N/A | N/A | N | PASS/BLOCK |

**OWASP Top 10 Compliance:**
- [ ] A01: Broken Access Control
- [ ] A02: Cryptographic Failures
- [ ] A03: Injection
- [ ] A04: Insecure Design
- [ ] A05: Security Misconfiguration
- [ ] A06: Vulnerable Components
- [ ] A07: Auth Failures
- [ ] A08: Data Integrity Failures
- [ ] A09: Logging Failures
- [ ] A10: SSRF

**Findings:**
- [List any security issues]

---

### 3. Test Coverage (test-generator)

| Suite | Total | Passed | Failed | Skipped | Coverage | Target | Status |
|-------|-------|--------|--------|---------|----------|--------|--------|
| Backend Unit | N | N | N | N | X% | 70% | PASS/FAIL |
| Backend Integration | N | N | N | N | X% | 70% | PASS/FAIL |
| Frontend Unit | N | N | N | N | X% | 70% | PASS/FAIL |
| E2E | N | N | N | N | N/A | N/A | PASS/FAIL |

**Test Quality:**
- [ ] Meaningful assertions (not just `assert result`)
- [ ] Edge cases covered (empty, error, timeout)
- [ ] No flaky tests (no sleep, no timing deps)
- [ ] MSW used for API mocking (not jest.mock)

**Coverage Gaps:**
- [List uncovered critical paths]

---

### 4. API Compliance (backend-system-architect)

| Check | Compliant | Issues |
|-------|-----------|--------|
| REST Conventions | Yes/No | [details] |
| Pydantic v2 Validation | Yes/No | [details] |
| RFC 9457 Error Handling | Yes/No | [details] |
| Async Timeout Protection | Yes/No | [details] |
| No N+1 Queries | Yes/No | [details] |

**Findings:**
- [List any API compliance issues]

---

### 5. UI Compliance (frontend-ui-developer)

| Check | Compliant | Issues |
|-------|-----------|--------|
| React 19 APIs (useOptimistic, useFormStatus, use()) | Yes/No | [details] |
| Zod Validation on API Responses | Yes/No | [details] |
| Exhaustive Type Checking | Yes/No | [details] |
| Skeleton Loading States | Yes/No | [details] |
| Prefetching on Navigation | Yes/No | [details] |
| WCAG 2.1 AA Accessibility | Yes/No | [details] |

**Findings:**
- [List any UI compliance issues]

---

## Quality Gates Summary

| Gate | Required | Actual | Status |
|------|----------|--------|--------|
| Test Coverage | >= 70% | X% | PASS/FAIL |
| Security Critical | 0 | N | PASS/FAIL |
| Security High | <= 5 | N | PASS/FAIL |
| Type Errors | 0 | N | PASS/FAIL |
| Lint Errors | 0 | N | PASS/FAIL |

**Overall Gate Status**: [ALL PASS | SOME FAIL]

---

## Blockers (Must Fix Before Merge)

1. [Blocker description with file:line reference]
2. [Blocker description with file:line reference]

---

## Suggestions (Non-Blocking)

1. [Suggestion for improvement]
2. [Suggestion for improvement]

---

## Evidence Artifacts

| Artifact | Location | Generated |
|----------|----------|-----------|
| Test Results | `/tmp/test_results.log` | [timestamp] |
| Coverage Report | `/tmp/coverage.json` | [timestamp] |
| Security Scan | `/tmp/security_audit.json` | [timestamp] |
| Lint Report | `/tmp/lint_results.log` | [timestamp] |
| E2E Screenshot | `/tmp/verification.png` | [timestamp] |

---

## Verification Metadata

- **Agents Used**: 5 (code-quality-reviewer, security-auditor, test-generator, backend-system-architect, frontend-ui-developer)
- **Parallel Execution**: Yes
- **Total Tool Calls**: ~N
- **Context Usage**: ~N tokens
```

---

## Status Definitions

| Status | Emoji | Meaning | Action Required |
|--------|-------|---------|-----------------|
| READY FOR MERGE | Green | All checks pass, no blockers | Approve PR |
| NEEDS ATTENTION | Yellow | Minor issues found | Review suggestions, optionally fix |
| BLOCKED | Red | Critical issues found | Must fix before merge |

## Severity Levels

| Level | Threshold | Action | Blocks Merge |
|-------|-----------|--------|--------------|
| Critical | Any | Fix immediately | YES |
| High | > 5 | Fix before merge | YES |
| Medium | > 20 | Should fix | NO (with justification) |
| Low | > 50 | Nice to have | NO |
| Info | N/A | Informational | NO |

## Agent Output JSON Schemas

### code-quality-reviewer Output
```json
{
  "linting": {"tool": "ruff|biome", "exit_code": 0, "errors": 0, "warnings": 0},
  "type_check": {"tool": "ty|tsc", "exit_code": 0, "errors": 0},
  "patterns": {"violations": [], "compliance": "PASS|FAIL"},
  "approval": {"status": "APPROVED|NEEDS_FIXES", "blockers": []}
}
```

### security-auditor Output
```json
{
  "scan_summary": {"files_scanned": 100, "vulnerabilities_found": 0},
  "critical": [],
  "high": [],
  "secrets_detected": [],
  "recommendations": [],
  "approval": {"status": "PASS|BLOCK", "blockers": []}
}
```

### test-generator Output
```json
{
  "coverage": {"current": 85, "target": 70, "passed": true},
  "test_summary": {"total": 100, "passed": 98, "failed": 2, "skipped": 0},
  "gaps": ["file:line - reason"],
  "quality_issues": [],
  "approval": {"status": "PASS|FAIL", "blockers": []}
}
```

### backend-system-architect Output
```json
{
  "api_compliance": {"rest_conventions": true, "issues": []},
  "validation": {"pydantic_v2": true, "issues": []},
  "error_handling": {"rfc9457": true, "issues": []},
  "async_safety": {"timeouts": true, "issues": []},
  "approval": {"status": "PASS|FAIL", "blockers": []}
}
```

### frontend-ui-developer Output
```json
{
  "react_19": {"apis_used": ["useOptimistic"], "missing": [], "compliant": true},
  "zod_validation": {"validated_endpoints": 10, "unvalidated": []},
  "type_safety": {"exhaustive_switches": true, "any_types": 0},
  "ux_patterns": {"skeletons": true, "prefetching": true},
  "accessibility": {"wcag_issues": []},
  "approval": {"status": "PASS|FAIL", "blockers": []}
}
```