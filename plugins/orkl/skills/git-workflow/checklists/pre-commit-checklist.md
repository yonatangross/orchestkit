# Pre-Commit Checklist

Validation steps before creating a commit.

## Atomic Commit Check

```
[ ] Does ONE logical thing (no "and" in description)
[ ] Can be reverted independently
[ ] Leaves codebase in working state
[ ] Tests pass after this commit
```

### Signs of Non-Atomic Commits

```
BAD:  "Add auth and fix typos"           → Split into 2 commits
BAD:  "Refactor users, update tests"     → Split into 2 commits
BAD:  "WIP"                              → Finish or stash
GOOD: "feat(auth): Add JWT validation"   → Single concern
```

## Staged Changes Review

```bash
# What's staged (will be committed)
git diff --staged

# What's NOT staged (will NOT be committed)
git diff

# Files overview
git status
```

### Interactive Staging

```bash
# Stage hunks selectively
git add -p

# Keybindings:
# y = stage this hunk
# n = skip this hunk
# s = split into smaller hunks
# e = edit hunk manually
# q = quit (staged so far remains)
```

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Valid Types

| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting (no code change) |
| `refactor` | Code change (no feature/fix) |
| `test` | Adding/fixing tests |
| `chore` | Build, deps, tooling |

### Message Rules

```
[ ] Title < 50 characters
[ ] Title uses imperative mood ("Add" not "Added")
[ ] Title doesn't end with period
[ ] Body wraps at 72 characters
[ ] Body explains WHY, not WHAT
[ ] Footer references issues (Closes #123)
```

### Examples

```bash
# Good
git commit -m "feat(api): Add rate limiting to /users endpoint"

# With body (use editor or heredoc)
git commit -m "$(cat <<'EOF'
fix(auth): Handle expired refresh tokens gracefully

Previously, expired refresh tokens caused 500 errors. Now returns
401 with clear error message and invalidates the session.

Closes #456
EOF
)"
```

## Final Checks

```bash
# Verify staged content is correct
git diff --staged --stat

# Verify not committing to protected branch
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" =~ ^(main|master|dev|develop)$ ]]; then
  echo "ERROR: Cannot commit directly to $BRANCH"
  exit 1
fi

# Check for debug code
git diff --staged | grep -E "(console\.log|debugger|print\(|pdb)" && \
  echo "WARNING: Debug code detected"

# Check for secrets
git diff --staged | grep -iE "(password|secret|api.?key|token)" && \
  echo "WARNING: Possible secrets detected"
```

## Quick Commit Flow

```bash
# 1. Review changes
git status
git diff

# 2. Stage selectively
git add -p

# 3. Verify staged
git diff --staged

# 4. Commit with message
git commit -m "feat(scope): Description"

# 5. Verify commit
git log --oneline -1
git show --stat
```

## Undo Last Commit

```bash
# Keep changes staged
git reset --soft HEAD~1

# Keep changes unstaged
git reset HEAD~1

# Discard everything (DANGEROUS)
git reset --hard HEAD~1
```

## Related

- [Interactive Staging](../references/interactive-staging.md)
- [Recovery Decision Tree](../references/recovery-decision-tree.md)
