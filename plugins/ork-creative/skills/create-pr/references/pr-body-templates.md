---
title: PR Body Templates
version: 1.0.0
---

# PR Body Templates

## Standard Template

For most PRs (features, bug fixes, refactors):

```markdown
## Summary
[1-2 sentence description of what this PR does and why]

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

For small fixes and chores (under 50 lines changed):

```markdown
## Summary
Fix typo in error message

## Test Plan
- [x] Unit tests pass

Closes #123

---
Generated with [Claude Code](https://claude.com/claude-code)
```

## Feature Template

For new features with UI, infrastructure, or deployment implications:

```markdown
## Summary
Add user profile page with avatar upload

## Changes
- Create ProfilePage component
- Add profile API endpoint
- Implement avatar upload with S3
- Add unit and integration tests

## Screenshots
[If applicable — paste screenshots of UI changes]

## Test Plan
- [x] Unit tests: 15 new tests
- [x] Integration tests: 3 new tests
- [x] Manual testing: Verified upload works
- [x] Accessibility: Keyboard navigation works

## Deployment Notes
- Requires S3 bucket configuration
- Run migration: `alembic upgrade head`

Closes #456

---
Generated with [Claude Code](https://claude.com/claude-code)
```

## HEREDOC Pattern for `gh pr create`

Always use HEREDOC to avoid shell escaping issues:

```bash
gh pr create --base dev \
  --title "feat(#123): add user profile page" \
  --body "$(cat <<'EOF'
## Summary
Add user profile page with avatar upload and S3 integration.

## Changes
- Create ProfilePage component
- Add profile API endpoint
- Implement avatar upload with S3

## Test Plan
- [x] Unit tests pass (15 new)
- [x] Lint/type checks clean

Closes #123

---
Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
