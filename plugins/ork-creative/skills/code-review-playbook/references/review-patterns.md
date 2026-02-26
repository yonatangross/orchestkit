# Code Review Patterns & Practices

This reference guide covers common review patterns, conventional comments, depth levels, and security focus areas.

---

## Conventional Comments

Use structured comment prefixes to set clear expectations for the author. This pattern originated from [conventionalcomments.org](https://conventionalcomments.org/).

### Standard Prefixes

| Prefix | Meaning | Requires Action | Example |
|--------|---------|-----------------|---------|
| **praise** | Highlight good work | No | `praise: Excellent use of type guards here!` |
| **nitpick** | Minor style/formatting | No (optional) | `nitpick: Consider using const instead of let` |
| **suggestion** | Propose improvement | No (consider) | `suggestion: Extract this to a helper function` |
| **issue** | Problem to address | Yes (mild) | `issue: This breaks when array is empty` |
| **question** | Seek clarification | Yes (answer) | `question: Why fetch data twice here?` |
| **thought** | Thinking out loud | No | `thought: Wonder if we'll need pagination later` |
| **chore** | Routine task | Yes | `chore: Add type definition for this interface` |
| **note** | Point out context | No | `note: This behavior changed in React 19` |
| **todo** | Follow-up work | Yes (track) | `todo: Add error boundary for this component` |
| **security** | Security concern | Yes (critical) | `security: Sanitize user input before SQL query` |
| **performance** | Performance issue | Yes (if severe) | `performance: N+1 query detected in loop` |
| **breaking** | Breaking change | Yes (critical) | `breaking: This changes the API contract` |

### Decorators (Optional)

Add decorators to clarify urgency:

- **blocking:** Must be fixed before merge
- **non-blocking:** Can be addressed later
- **if-minor:** Only if it's a quick fix

**Examples:**
```
issue (blocking): SQL injection risk - sanitize input
suggestion (non-blocking): Consider memoizing this calculation
nitpick (if-minor): Add newline at end of file
```

---

## Review Depth Levels

Adjust review depth based on change type, author experience, and risk.

### Level 1: Light Review (5-10 minutes)
**When to use:**
- Documentation-only changes
- Test-only additions
- Config/dependency updates (low risk)
- Experienced author, small change

**What to check:**
- [ ] CI passes (lint, tests, type check)
- [ ] No obvious security issues (secrets, SQL injection)
- [ ] Commit message follows convention
- [ ] PR description explains "why"

**Example comment:**
```
LGTM! CI green, change is isolated.

nitpick: Consider adding a test case for edge case X
```

---

### Level 2: Standard Review (15-30 minutes)
**When to use:**
- New features (medium complexity)
- Bug fixes with logic changes
- Refactoring existing code
- Moderate author experience

**What to check:**
- [ ] **Correctness:** Logic handles edge cases (empty arrays, null, undefined)
- [ ] **Tests:** Unit tests cover happy path + edge cases (80%+ coverage)
- [ ] **Type safety:** No `any` types, proper null checks
- [ ] **Error handling:** Try/catch for async, meaningful error messages
- [ ] **Performance:** No obvious N+1 queries, unnecessary re-renders
- [ ] **Security:** Input validation, no hardcoded secrets
- [ ] **Documentation:** JSDoc for public APIs, README updates if needed

**Example comment:**
```
issue (blocking): Missing error handling in fetchAnalysis()
- What happens if API returns 500?
- Add try/catch and show user-friendly error message

suggestion: Consider extracting validation logic to Zod schema
- Reusable across API + frontend
- Centralized validation rules

praise: Great test coverage! Love the edge case tests.
```

---

### Level 3: Deep Review (30-60 minutes)
**When to use:**
- Critical path features (auth, payments, data loss risk)
- Architecture changes (new patterns, major refactors)
- Security-sensitive code (authentication, authorization, PII)
- Junior author or unfamiliar codebase area

**What to check (includes Level 2, plus):**
- [ ] **Architecture:** Fits existing patterns, doesn't introduce coupling
- [ ] **Scalability:** Handles 10x growth (users, data volume)
- [ ] **Maintainability:** Code is readable, well-documented, DRY
- [ ] **Security (OWASP):** Injection, auth, XSS, CSRF, exposure, misconfiguration
- [ ] **Observability:** Logging, error tracking, metrics
- [ ] **Migration path:** Database migrations, backward compatibility
- [ ] **Rollback plan:** Feature flags, circuit breakers
- [ ] **E2E tests:** Critical flows tested end-to-end

**Example comment:**
```
security (blocking): Multiple OWASP Top 10 violations detected

1. SQL Injection (A03):
   - Line 45: User input concatenated into SQL query
   - Fix: Use parameterized queries (SQLAlchemy already supports this)

2. Broken Access Control (A01):
   - Line 78: No check if user owns this analysis
   - Fix: Add ownership check before allowing update

3. Security Logging Failures (A09):
   - No audit log for data deletion
   - Fix: Log user_id, analysis_id, timestamp to audit table

performance: Potential N+1 query in loop (lines 102-110)
- Fetching chunks individually instead of batch query
- Fix: Use `SELECT WHERE id IN (...)` to fetch all at once
- Expected impact: 50ms → 5ms for 10 chunks

suggestion: Add feature flag for this rollout
- New analysis pipeline is high-risk change
- Allows gradual rollout + quick rollback
- Example: `if feature_flags.is_enabled('new_pipeline', user_id):`

question: How does this handle concurrent updates?
- Two users editing same analysis simultaneously
- Do we need optimistic locking (version field)?

praise: Excellent error messages! These will make debugging much easier.
```

---

## Security Focus Areas

### OWASP Top 10 (2021) Checklist

Use this checklist for every security-sensitive change:

#### A01: Broken Access Control
- [ ] Check user authentication before accessing resources
- [ ] Verify user owns the resource (analysis, artifact, etc.)
- [ ] Validate permissions for create/read/update/delete
- [ ] No direct object references without authorization (e.g., `/api/analyses/123`)

**Example violation:**
```python
# BAD: Anyone can delete any analysis
@router.delete("/analyses/{analysis_id}")
async def delete_analysis(analysis_id: int):
    await repo.delete(analysis_id)  # ❌ No auth check!

# GOOD: Check ownership first
@router.delete("/analyses/{analysis_id}")
async def delete_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user)
):
    analysis = await repo.get(analysis_id)
    if analysis.user_id != current_user.id:
        raise HTTPException(403, "Not authorized")
    await repo.delete(analysis_id)
```

---

#### A02: Cryptographic Failures
- [ ] No passwords/API keys in plaintext (use bcrypt, environment variables)
- [ ] Sensitive data encrypted at rest (PII, payment info)
- [ ] HTTPS enforced for all endpoints
- [ ] No sensitive data in logs or error messages

**Example violation:**
```python
# BAD: Password in plaintext
user = User(email=email, password=password)  # ❌

# GOOD: Hash password
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
user = User(email=email, password_hash=pwd_context.hash(password))
```

---

#### A03: Injection (SQL, NoSQL, Command)
- [ ] Use parameterized queries (never string concatenation)
- [ ] Validate/sanitize all user input
- [ ] Use ORM (SQLAlchemy) instead of raw SQL when possible
- [ ] Escape HTML output to prevent XSS

**Example violation:**
```python
# BAD: SQL injection risk
query = f"SELECT * FROM analyses WHERE url = '{user_url}'"  # ❌
results = db.execute(query)

# GOOD: Parameterized query
query = "SELECT * FROM analyses WHERE url = :url"
results = db.execute(query, {"url": user_url})

# BEST: Use ORM
results = db.query(Analysis).filter(Analysis.url == user_url).all()
```

---

**Remember:** Code review is about **collaboration**, not gatekeeping. Explain reasoning, suggest alternatives, and celebrate good work. Every review is a learning opportunity for both author and reviewer.
