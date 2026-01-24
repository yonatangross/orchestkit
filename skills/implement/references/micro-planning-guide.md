# Micro-Planning Guide

Create detailed task-level plans before writing code to prevent scope creep and improve estimates.

## What to Include

| Section | Purpose |
|---------|---------|
| **Scope (IN)** | Explicit list of what will change |
| **Out of Scope** | What NOT to touch (prevents creep) |
| **Files to Touch** | Exact files, change type, description |
| **Acceptance Criteria** | How to know it's done |
| **Estimated Time** | Realistic time budget |

## Planning Process

### Step 1: Define Scope Boundaries

```markdown
### IN Scope
- Add User model with email, password_hash
- Add /register endpoint
- Add validation for email format

### OUT of Scope
- Password reset (separate task)
- OAuth providers (future task)
- Email verification (future task)
```

### Step 2: List Files Explicitly

```markdown
### Files to Touch
| File | Action | Description |
|------|--------|-------------|
| models/user.py | CREATE | User SQLAlchemy model |
| api/auth.py | CREATE | Register endpoint |
| tests/test_auth.py | CREATE | Registration tests |
| alembic/versions/xxx.py | CREATE | Migration |
```

### Step 3: Set Acceptance Criteria

```markdown
### Acceptance Criteria
- [ ] POST /register creates user
- [ ] Duplicate email returns 409
- [ ] Invalid email returns 422
- [ ] Password is hashed (not plaintext)
- [ ] Tests pass
- [ ] Types check
```

## Time-Boxing Techniques

| Task Size | Time Box | Break Point |
|-----------|----------|-------------|
| Small (1-3 files) | 30 min | 45 min |
| Medium (4-8 files) | 2 hours | 3 hours |
| Large (9+ files) | 4 hours | Split task |

### At Break Point

1. Stop and assess progress
2. If not 50%+ done, re-estimate
3. If blocked, create blocker task
4. Consider splitting remaining work

## When to Break Down Further

Split the task if:
- More than 8 files to modify
- Estimate exceeds 4 hours
- Multiple unrelated changes
- Requires learning new technology
- Has uncertain requirements

## Anti-Patterns

| Anti-Pattern | Fix |
|--------------|-----|
| Vague scope: "Add auth" | Specific: "Add /register endpoint" |
| No out-of-scope section | Always list what's excluded |
| Missing time estimate | Always estimate, even if rough |
| No acceptance criteria | Define "done" before starting |
