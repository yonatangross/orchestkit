---
title: Identify root cause before applying fixes to avoid masking real errors with suppressions
impact: CRITICAL
impactDescription: "Suppressing errors without root cause analysis hides real bugs, leading to data corruption and cascading failures"
tags: [errors, debugging, root-cause, troubleshooting]
---

# Identify Root Cause Before Fixing

## Why

The fastest "fix" for an error is to suppress it — wrap in try/catch, add `|| true`, or swallow the exception. This hides the symptom while the underlying bug causes data corruption, silent failures, or cascading issues downstream.

## Rule

Before applying any fix:
1. Read the full error message and stack trace
2. Identify the originating file and line number
3. Trace the data flow to the root cause
4. Fix the root cause, not the symptom
5. Verify the error is resolved, not just silenced

## Incorrect — suppress the error

```typescript
// Error: Cannot read property 'name' of undefined
// "Fix": suppress it
try {
  const name = user.profile.name;
} catch {
  const name = "Unknown"; // Masks null user or missing profile
}
```

```python
# Error: connection refused on port 5432
# "Fix": ignore it
try:
    db = connect("localhost:5432")
except Exception:
    pass  # Silently continues with no DB connection
```

```bash
# Error: command not found
# "Fix": suppress with || true
some_missing_command || true
echo "Continuing..." # Proceeds without required step
```

**Problems:**
- The null user indicates an auth bypass or missing middleware
- The connection error means the DB is down or misconfigured
- The missing command means a dependency is not installed

## Correct — trace to root cause then fix

```typescript
// Error: Cannot read property 'name' of undefined
// Root cause: auth middleware not applied to this route
// Fix: add auth middleware, then safely access user

// 1. Add missing auth middleware
router.get("/profile", requireAuth, async (req, res) => {
  // 2. User is now guaranteed by middleware
  const user = req.user; // Non-null after requireAuth
  res.json({ name: user.profile.name });
});
```

```python
# Error: connection refused on port 5432
# Root cause: DB container not started, or wrong port in config
# Fix: validate connection config, fail fast with actionable message

import os

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    raise RuntimeError(
        "DATABASE_URL not set. Run: docker compose up -d postgres"
    )

try:
    db = connect(db_url)
except ConnectionRefusedError as e:
    raise RuntimeError(
        f"Cannot connect to database at {db_url}. "
        "Is the postgres container running? Run: docker compose ps"
    ) from e
```

## Root Cause Checklist

| Symptom | Likely Root Cause | Do NOT Do |
|---------|-------------------|-----------|
| `undefined is not an object` | Missing null check or broken data flow | Wrap in try/catch |
| `connection refused` | Service not running or wrong config | Add `catch { pass }` |
| `command not found` | Missing dependency | Add `\|\| true` |
| `permission denied` | Wrong user or file permissions | Run as root |
| `ENOSPC` | Disk full | Delete random files |
