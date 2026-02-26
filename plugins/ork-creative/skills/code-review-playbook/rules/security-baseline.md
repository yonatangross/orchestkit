---
title: Apply security baseline checks during code review to prevent data breaches and unauthorized access
impact: CRITICAL
impactDescription: "Security violations in code review lead to data breaches, unauthorized access, and compliance failures"
tags: security, owasp, secrets, authentication, injection
---

## Security Baseline Review Rules

Security checks that apply to ALL languages. These are merge-blocking findings.

### No Hardcoded Secrets

```python
# VIOLATION: Secrets in code
API_KEY = "sk-1234567890abcdef"
DB_PASSWORD = "admin123"
JWT_SECRET = "mysecret"

# CORRECT: Environment variables
API_KEY = os.environ["API_KEY"]
DB_PASSWORD = os.environ.get("DB_PASSWORD")
```

```typescript
// VIOLATION: Secrets in code
const apiKey = "sk-1234567890abcdef";

// CORRECT: Environment variables
const apiKey = process.env.API_KEY;
```

**Detection patterns**: Look for variables named `*_KEY`, `*_SECRET`, `*_PASSWORD`, `*_TOKEN` with string literal values.

### Authentication on All Endpoints

```python
# VIOLATION: Unprotected endpoint
@app.get("/api/admin/users")
async def list_users():
    return await db.get_all_users()

# CORRECT: Auth middleware
@app.get("/api/admin/users")
async def list_users(user: User = Depends(require_admin)):
    return await db.get_all_users()
```

```typescript
// VIOLATION: No auth
router.get('/api/users', getUsers);

// CORRECT: Auth middleware
router.get('/api/users', requireAuth, getUsers);
```

### Input Validation

**Violation — SQL injection via f-string interpolation:**
```python
# VIOLATION: SQL injection
query = f"SELECT * FROM users WHERE id = {user_id}"
```

**Correct — parameterized query prevents injection:**
```python
query = "SELECT * FROM users WHERE id = $1"
await db.execute(query, user_id)
```

**Violation — XSS via raw innerHTML assignment:**
```typescript
// VIOLATION: XSS — raw HTML insertion
element.innerHTML = userInput;
```

**Correct — textContent auto-escapes HTML entities:**
```typescript
element.textContent = userInput;
```

### Dependency Audit

```bash
# Must run before merge:
npm audit          # JavaScript/TypeScript
pip-audit          # Python
```

| Finding | Action |
|---------|--------|
| Critical vulnerability | BLOCK merge |
| High vulnerability (> 5) | BLOCK merge |
| Moderate vulnerability | WARN, track |
| Low vulnerability | INFORM only |

### Debug/Development Code

```python
# VIOLATION: Debug code in production
import pdb; pdb.set_trace()
print(f"DEBUG: user password is {password}")
set -x  # In scripts with secrets in scope

# CORRECT: Remove before commit
logger.debug("User authenticated", extra={"user_id": user.id})
```

**Incorrect — hardcoded secrets, no auth, SQL injection:**
```python
# Hardcoded secret
API_KEY = "sk-1234567890abcdef"

# No auth protection
@app.get("/api/admin/users")
async def list_users():
    return await db.get_all_users()

# SQL injection vulnerability
query = f"SELECT * FROM users WHERE id = {user_id}"
```

**Correct — env vars, auth middleware, parameterized queries:**
```python
# Environment variables
API_KEY = os.environ["API_KEY"]

# Auth middleware
@app.get("/api/admin/users")
async def list_users(user: User = Depends(require_admin)):
    return await db.get_all_users()

# Parameterized query
query = "SELECT * FROM users WHERE id = $1"
await db.execute(query, user_id)
```

### Review Checklist

| Check | Severity | Action |
|-------|----------|--------|
| Hardcoded secrets | CRITICAL | BLOCK — use env vars |
| Missing auth | CRITICAL | BLOCK — add middleware |
| SQL injection | CRITICAL | BLOCK — parameterize |
| XSS vulnerability | CRITICAL | BLOCK — sanitize |
| Missing input validation | HIGH | BLOCK — validate at boundary |
| Debug code | HIGH | BLOCK — remove before merge |
| Dependency vulnerabilities | VARIES | See audit table above |
| `set -x` with secrets | HIGH | BLOCK — never expose secrets in logs |
