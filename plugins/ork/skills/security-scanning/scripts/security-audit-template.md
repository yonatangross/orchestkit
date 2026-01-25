---
name: security-audit-template
description: Template for security audit documentation
user-invocable: false
---

# Security Audit Template

Use this template to conduct security reviews of APIs, workflows, or entire applications.

## Audit Metadata

**Project**: [Project name]  
**Audit Date**: [YYYY-MM-DD]  
**Auditor**: [Name/Team]  
**Scope**: [What's being audited - specific endpoints, full app, etc.]  
**Risk Level**: [Low / Medium / High / Critical]

## Executive Summary

[2-3 sentence overview of findings]

**Overall Security Posture**: [Strong / Adequate / Weak / Critical Issues Found]

**Key Findings**:
- [Critical Issue 1]
- [High Priority Issue 2]
- [Notable Strength 1]

**Recommended Actions**:
1. [Most urgent action]
2. [Second priority action]
3. [Third priority action]

---

## 1. Authentication & Authorization (A01, A07)

### Findings

#### 1.1 Authentication Mechanisms
- [ ] **Authentication required** for all non-public endpoints?
- [ ] **JWT/session tokens** properly validated?
- [ ] **Password requirements** meet minimum standards (12+ chars, complexity)?
- [ ] **Account lockout** after failed attempts?
- [ ] **MFA available** for sensitive operations?

**Issues Found**:
| Severity | Issue | Location | Recommendation |
|----------|-------|----------|----------------|
| [Critical/High/Medium/Low] | [Description] | [File:line] | [Fix recommendation] |

#### 1.2 Authorization Checks
- [ ] **Resource-level authorization** enforced (users can't access others' data)?
- [ ] **Role-based access control** implemented correctly?
- [ ] **Default-deny** approach used (explicit allow required)?

**Issues Found**:
| Severity | Issue | Location | Recommendation |
|----------|-------|----------|----------------|

---

## 2. Input Validation & Injection (A03)

#### 2.1 SQL Injection
- [ ] **Parameterized queries** used exclusively (no string concatenation)?
- [ ] **ORM used correctly** (no raw SQL with user input)?

#### 2.2 Input Validation
- [ ] **Pydantic validation** on all request schemas?
- [ ] **Length limits** enforced (max string length, array size)?
- [ ] **Type validation** prevents unexpected types?

#### 2.3 Command Injection
- [ ] **No shell=True** in subprocess calls?
- [ ] **User input never** passed to shell commands?

---

## 3. Cryptography & Data Protection (A02)

#### 3.1 Data in Transit
- [ ] **HTTPS enforced** in production?
- [ ] **Secure cookie settings** (httponly, secure, samesite)?

#### 3.2 Data at Rest
- [ ] **Passwords hashed** with bcrypt/scrypt?
- [ ] **Sensitive data encrypted** before storage?

#### 3.3 Secrets Management
- [ ] **No hardcoded secrets** in code?
- [ ] **Environment variables** used for configuration?
- [ ] **.env files** in .gitignore?

---

## 4. Security Misconfiguration (A05)

#### 4.1 Default Configuration
- [ ] **Debug mode disabled** in production?
- [ ] **Default credentials changed**?
- [ ] **Unnecessary features disabled**?
- [ ] **Error messages** don't leak implementation details?

#### 4.2 Security Headers
- [ ] **X-Content-Type-Options: nosniff** set?
- [ ] **X-Frame-Options: DENY** set?
- [ ] **Strict-Transport-Security** set?
- [ ] **Content-Security-Policy** defined?

#### 4.3 CORS Configuration
- [ ] **CORS origins** explicitly whitelisted (not `*`)?
- [ ] **Credentials allowed** only for trusted origins?

---

## 5. Vulnerable Dependencies (A06)

#### 5.1 Dependency Scanning
- [ ] **pip-audit run** and passed?
- [ ] **Dependencies up to date**?
- [ ] **Lockfile used**?

**Scan Results**:
```bash
# Run pip-audit
poetry run pip-audit

# Results:
Critical: [count]
High: [count]
Medium: [count]
Low: [count]
```

---

## 6. Logging & Monitoring (A09)

#### 6.1 Security Event Logging
- [ ] **Authentication events logged**?
- [ ] **Authorization failures logged**?
- [ ] **Critical operations audited**?
- [ ] **Structured logging** used?

#### 6.2 Monitoring & Alerting
- [ ] **Failed login monitoring**?
- [ ] **Rate limit violations** tracked?
- [ ] **Error rate alerting** configured?

---

## 7. API-Specific Security

#### 7.1 Rate Limiting
- [ ] **Rate limits enforced** on all public endpoints?
- [ ] **Per-user rate limits** for authenticated endpoints?

#### 7.2 Request Size Limits
- [ ] **Request body size limited**?
- [ ] **File upload size limited**?
- [ ] **Array/collection size limited**?

#### 7.3 SSRF Protection
- [ ] **URL validation** for user-provided URLs?
- [ ] **Internal network access blocked**?
- [ ] **Redirect following disabled** or limited?

---

## Summary of Findings

### Critical Issues (Fix Immediately)
1. [Issue description] - [Location]

### High Priority Issues (Fix This Sprint)
1. [Issue description] - [Location]

### Medium Priority Issues (Fix Next Sprint)
1. [Issue description] - [Location]

### Low Priority / Nice to Have
1. [Issue description] - [Location]

### Positive Findings (Security Strengths)
- [Good security practice observed]

---

## Remediation Plan

| Issue ID | Severity | Description | Assigned To | Target Date | Status |
|----------|----------|-------------|-------------|-------------|--------|
| SEC-001 | Critical | [Description] | [Name] | [YYYY-MM-DD] | [Open/In Progress/Resolved] |

---

## Re-Audit Schedule

**Next Audit Date**: [YYYY-MM-DD]  
**Audit Frequency**: [Monthly / Quarterly]  
**Responsible Party**: [Team/Person]

---

**Audit Completed By**: [Name]  
**Date**: [YYYY-MM-DD]
