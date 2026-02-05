# Micro-Plan: [Task Name]

## Scope

### IN Scope
- [ ] Change 1
- [ ] Change 2
- [ ] Test for change 1
- [ ] Test for change 2

### OUT of Scope
- Feature X (separate task)
- Optimization Y (future)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| path/to/file.py | CREATE | Description |
| path/to/test.py | CREATE | Tests |
| path/to/existing.py | MODIFY | Add method |

## Acceptance Criteria

- [ ] Primary functionality works
- [ ] Edge cases handled
- [ ] Tests pass
- [ ] Types check (`mypy`/`tsc`)
- [ ] Lint clean

## Estimated Time

- [ ] 30 min
- [ ] 1 hour
- [ ] 2 hours
- [ ] 4 hours (consider splitting)

## Notes

_Any context, dependencies, or blockers_

---

## Example: Add User Registration

### IN Scope
- [ ] User model with email, password_hash
- [ ] POST /register endpoint
- [ ] Email format validation
- [ ] Unit tests for registration

### OUT of Scope
- Password reset flow
- Email verification
- OAuth providers

### Files to Touch

| File | Action | Description |
|------|--------|-------------|
| models/user.py | CREATE | User SQLAlchemy model |
| api/auth.py | CREATE | Register endpoint |
| tests/test_auth.py | CREATE | Registration tests |

### Acceptance Criteria

- [ ] POST /register creates user in DB
- [ ] Duplicate email returns 409 Conflict
- [ ] Invalid email returns 422 Validation Error
- [ ] Password stored as bcrypt hash
- [ ] All tests pass

### Estimated Time

- [x] 1 hour
