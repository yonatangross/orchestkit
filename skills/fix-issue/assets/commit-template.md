# Commit and PR Templates

## Commit Message Format

```
fix(#ISSUE_NUMBER): [Brief description of fix]

- [Change 1]
- [Change 2]
- [Tests added/updated]

Root cause: [Brief explanation]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## PR Body Template

```markdown
## Summary
Fixes #ISSUE_NUMBER

## Root Cause
[Explanation of what caused the issue]

## Solution
[How the fix addresses the root cause]

## Changes
- [File 1]: [What changed]
- [File 2]: [What changed]

## Tests
- [x] Unit tests added
- [x] Edge cases covered
- [x] All tests pass

## Verification
- [ ] Manually tested the fix
- [ ] No regression in related functionality

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## Example Commands

```bash
# Stage changes
git add .

# Commit with issue reference
git commit -m "$(cat <<'EOF'
fix(#123): Resolve null pointer in user authentication

- Add null check before accessing user.profile
- Handle case where session expires mid-request
- Add unit test for expired session scenario

Root cause: Session object was not validated before profile access

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

# Push and create PR
git push -u origin issue/123-fix

gh pr create --base dev \
  --title "fix(#123): Resolve null pointer in user authentication" \
  --body "$(cat <<'EOF'
## Summary
Fixes #123

## Root Cause
Session object was being accessed without validation, causing null pointer when session expires mid-request.

## Solution
Added null check and proper session validation before accessing user profile data.

## Changes
- `backend/app/services/auth.py`: Added session validation
- `backend/tests/unit/test_auth.py`: Added expired session test

## Tests
- [x] Unit tests added
- [x] Edge cases covered
- [x] All tests pass

## Verification
- [ ] Manually tested the fix
- [ ] No regression in related functionality

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```