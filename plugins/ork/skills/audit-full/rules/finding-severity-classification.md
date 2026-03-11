---
title: Classify audit findings by severity with evidence from actual code locations
impact: HIGH
impactDescription: "Misclassified findings cause teams to ignore critical vulnerabilities or waste time on low-risk items"
tags: [audit, severity, classification, evidence, security]
---

# Classify Findings by Severity with Evidence

## Why

Without evidence-backed severity classification, findings are either all "CRITICAL" (causing alert fatigue) or uniformly "MEDIUM" (hiding real risks). Both patterns erode trust in audit reports.

## Rule

Every finding must include:
1. Severity level (CRITICAL / HIGH / MEDIUM / LOW)
2. File path and line number
3. Code snippet showing the vulnerability
4. Exploitation scenario or impact statement
5. OWASP/CWE classification where applicable

## Incorrect — vague findings without evidence

```markdown
## Findings

| # | Severity | Finding |
|---|----------|---------|
| 1 | HIGH | SQL injection possible |
| 2 | MEDIUM | Auth might be missing |
| 3 | HIGH | Dependencies outdated |
```

**Problems:**
- No file paths — developer cannot locate the issue
- No code evidence — finding cannot be verified
- No exploitation scenario — severity is arbitrary
- "might be missing" is not a finding, it is speculation

## Correct — evidence-backed severity classification

```markdown
## Findings

| # | Severity | Category | File(s) | Finding |
|---|----------|----------|---------|---------|
| 1 | CRITICAL | Injection (CWE-89) | src/api/users.ts:42 | SQL injection via string interpolation |

### Finding 1: SQL Injection (CRITICAL)

**Location:** `src/api/users.ts:42`
**OWASP:** A03:2021 Injection | **CWE:** CWE-89

**Vulnerable code:**
  ```typescript
  const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
  await db.execute(query);
  ```

**Exploitation:** Attacker sends `id=1; DROP TABLE users--` via
GET /api/users/:id. No parameterization or input validation exists
between the route handler (line 38) and the query execution (line 42).

**Remediation:**
  ```typescript
  const query = "SELECT * FROM users WHERE id = $1";
  await db.execute(query, [req.params.id]);
  ```
```

## Severity Classification Criteria

| Severity | Criteria | Example |
|----------|----------|---------|
| CRITICAL | Exploitable without auth, data loss/breach | SQL injection, RCE, auth bypass |
| HIGH | Exploitable with auth, significant impact | IDOR, privilege escalation, SSRF |
| MEDIUM | Requires specific conditions to exploit | CSRF, info disclosure, weak crypto |
| LOW | Minimal impact, defense-in-depth | Missing headers, verbose errors |
