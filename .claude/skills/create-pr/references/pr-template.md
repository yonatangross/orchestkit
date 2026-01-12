# PR Template

## Standard Template

```markdown
## Summary
[1-2 sentence description of what this PR does]

## Changes
- [Change 1]
- [Change 2]

## Type
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Docs
- [ ] Test
- [ ] Chore

## Breaking Changes
- [ ] None
- [ ] Yes: [describe migration steps]

## Related Issues
- Closes #ISSUE

## Test Plan
- [x] Unit tests pass
- [x] Lint/type checks pass
- [ ] Manual testing: [describe]

---
Generated with [Claude Code](https://claude.com/claude-code)
```

## Minimal Template

For small fixes:

```markdown
## Summary
Fix typo in error message

## Test Plan
- [x] Unit tests pass

Closes #123
```

## Feature Template

For new features:

```markdown
## Summary
Add user profile page with avatar upload

## Changes
- Create ProfilePage component
- Add profile API endpoint
- Implement avatar upload with S3
- Add unit and integration tests

## Screenshots
[If applicable]

## Test Plan
- [x] Unit tests: 15 new tests
- [x] Integration tests: 3 new tests
- [x] Manual testing: Verified upload works
- [x] Accessibility: Keyboard navigation works

## Deployment Notes
- Requires S3 bucket configuration
- Run migration: `alembic upgrade head`

Closes #456
```