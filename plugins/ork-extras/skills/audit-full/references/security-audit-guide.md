# Security Audit Guide

Cross-file vulnerability analysis patterns for whole-codebase audits.

## Data Flow Tracing

Trace user input from entry to storage across file boundaries:

```
Entry Point → Validation → Processing → Storage
(route.ts)    (middleware)   (service.ts)  (repo.ts)
```

### What to Check at Each Stage

| Stage | Check | Severity if Missing |
|-------|-------|-------------------|
| Entry | Input validation, type coercion | HIGH |
| Validation | Schema validation, sanitization | CRITICAL |
| Processing | Business logic auth checks | HIGH |
| Storage | Parameterized queries, encoding | CRITICAL |

## Cross-File Vulnerability Patterns

### 1. Auth Bypass via Missing Middleware

```
# PATTERN: Route defined without auth middleware
router.get('/admin/users', getUsersHandler)  # No authMiddleware!

# Compare against protected routes:
router.get('/admin/settings', authMiddleware, getSettingsHandler)
```

**Detection**: Glob all route files, check each handler has auth middleware.

### 2. SQL Injection via String Interpolation

```
# PATTERN: Variable in SQL string (any file)
query(`SELECT * FROM users WHERE id = '${userId}'`)

# Safe pattern:
query('SELECT * FROM users WHERE id = $1', [userId])
```

**Detection**: Grep for template literals containing SQL keywords.

### 3. Command Injection via Shell Exec

```
# PATTERN: User input in exec/spawn
exec(`git log --author="${username}"`)

# Safe pattern:
execFile('git', ['log', `--author=${username}`])
```

**Detection**: Grep for `exec(`, `execSync(`, `spawn(` with template literals.

### 4. Secret Leakage

```
# PATTERN: Hardcoded secrets
const API_KEY = 'sk-live-abc123...'
const password = 'admin123'

# PATTERN: Secrets in error messages
throw new Error(`Auth failed for ${password}`)

# PATTERN: Secrets in logs
console.log(`Connecting with key: ${apiKey}`)
```

**Detection**: Grep for common secret patterns (`sk-`, `ghp_`, `Bearer `, password assignments).

### 5. SSRF via Unvalidated URLs

```
# PATTERN: User-controlled URL in fetch/axios
const response = await fetch(req.body.url)

# Safe pattern:
const url = new URL(req.body.url)
if (!ALLOWED_HOSTS.includes(url.hostname)) throw new Error('Blocked')
```

### 6. Path Traversal

```
# PATTERN: User input in file path
const filePath = path.join(uploadDir, req.params.filename)
// filename could be '../../etc/passwd'

# Safe pattern:
const resolved = path.resolve(uploadDir, req.params.filename)
if (!resolved.startsWith(uploadDir)) throw new Error('Blocked')
```

## OWASP Top 10 Mapping

| OWASP | What to Look For |
|-------|-----------------|
| A01 Broken Access Control | Missing auth middleware, IDOR, privilege escalation |
| A02 Cryptographic Failures | Weak hashing, HTTP for sensitive data, hardcoded keys |
| A03 Injection | SQL, command, template injection across boundaries |
| A04 Insecure Design | Missing rate limiting, no abuse prevention |
| A05 Security Misconfiguration | Debug mode in prod, default credentials, CORS * |
| A06 Vulnerable Components | Outdated deps with known CVEs |
| A07 Auth Failures | Weak passwords, no MFA, session fixation |
| A08 Data Integrity | Unsigned updates, CI/CD without verification |
| A09 Logging Failures | Missing audit logs, secrets in logs |
| A10 SSRF | Unvalidated URLs in server-side requests |

## Severity Classification

| Severity | Criteria |
|----------|----------|
| CRITICAL | Exploitable without authentication, data breach risk |
| HIGH | Exploitable with low-privilege access, system compromise |
| MEDIUM | Requires specific conditions, limited impact |
| LOW | Informational, defense-in-depth improvement |
