# Branch Checklist

Pre-flight checks before creating and working with branches.

## Before Creating a Branch

```
[ ] main is up to date (`git pull origin main`)
[ ] No uncommitted changes (`git status` is clean)
[ ] Issue/ticket exists for the work
[ ] Branch name follows convention
```

## Branch Naming Validation

```bash
# Valid patterns
issue/123-add-user-auth     # Linked to issue (preferred)
feature/oauth-integration   # No issue, feature work
fix/null-pointer-api        # Bug fix
hotfix/security-patch       # Urgent production fix

# Invalid patterns
my-branch                   # No prefix
ISSUE-123                   # Wrong format
feature/Add_User_Auth       # No underscores/capitals
```

### Quick Validation

```bash
# Check branch name format
BRANCH=$(git branch --show-current)

if [[ ! "$BRANCH" =~ ^(issue|feature|fix|hotfix|release)/ ]]; then
  echo "WARNING: Branch '$BRANCH' doesn't follow naming convention"
fi
```

## Before First Commit

```
[ ] Correct branch (not main/dev)
[ ] Branch tracks remote (`git push -u origin <branch>`)
[ ] Working directory is clean except intended changes
```

## Before Push

```
[ ] All tests pass locally
[ ] No debug code (console.log, print, debugger)
[ ] No secrets or credentials
[ ] Commits are atomic (one logical change each)
[ ] Commit messages follow conventional format
```

## Before PR

```
[ ] Branch rebased on latest main
[ ] No merge conflicts
[ ] CI passing on branch
[ ] Self-reviewed the diff
[ ] Issue linked in PR description
```

## Branch Lifecycle

```
1. Create    → git checkout -b issue/123-feature
2. Work      → atomic commits, frequent pushes
3. Sync      → git fetch && git rebase origin/main
4. PR        → gh pr create
5. Review    → address feedback
6. Merge     → squash or rebase merge
7. Cleanup   → git branch -d issue/123-feature
```

## Emergency: Wrong Branch

```bash
# Accidentally committed to main?
# 1. Create branch from current state
git branch fix/my-changes

# 2. Reset main to origin
git reset --hard origin/main

# 3. Switch to new branch
git checkout fix/my-changes
```

## Related

- [GitHub Flow](../references/github-flow.md)
- [Recovery Decision Tree](../references/recovery-decision-tree.md)
