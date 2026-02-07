# Audit Completion Checklist

Verify before finalizing the audit report.

## Pre-Report Verification

### Coverage

- [ ] All source files in scope were loaded (check file count vs glob count)
- [ ] Entry points identified and traced
- [ ] Configuration files reviewed (env, docker, CI)
- [ ] Lock files checked (package-lock.json, poetry.lock, go.sum)

### Security (if applicable)

- [ ] All public endpoints checked for auth middleware
- [ ] Data flow traced from input → storage for at least 3 critical paths
- [ ] Secret detection scan completed (grep for API keys, passwords, tokens)
- [ ] OWASP Top 10 categories all considered (mark N/A if not applicable)
- [ ] Third-party integrations checked for SSRF risk
- [ ] File upload/download paths checked for traversal

### Architecture (if applicable)

- [ ] Dependency direction verified (imports flow inward)
- [ ] Circular dependencies checked
- [ ] Pattern consistency evaluated (error handling, validation, data access)
- [ ] Module coupling analyzed (cross-directory import counts)
- [ ] Layer violations identified
- [ ] ASCII architecture diagram generated

### Dependencies (if applicable)

- [ ] `npm audit` / `pip-audit` / equivalent run
- [ ] License compliance checked (no GPL in proprietary)
- [ ] Outdated packages identified with severity
- [ ] Unused dependencies flagged
- [ ] Transitive dependency risks assessed

### Report Quality

- [ ] Every finding has specific file:line references
- [ ] Every finding has a remediation suggestion with code
- [ ] Severity classifications match the severity matrix
- [ ] No duplicate findings (same root cause reported once)
- [ ] False positives verified and removed
- [ ] Recommendations prioritized by impact and effort
- [ ] Executive summary accurately reflects findings
- [ ] Health score calculated correctly

### Completeness

- [ ] All selected audit modes completed
- [ ] Context utilization reported (tokens used / available)
- [ ] Files list in appendix matches loaded files
- [ ] Report follows the template structure
