---
name: create-pr
description: Create GitHub pull requests with validation and auto-generated descriptions. Use when creating pull requests, opening PRs, submitting code for review.
context: fork
version: 1.0.0
author: SkillForge
tags: [git, github, pull-request, pr, code-review]
user-invocable: true
---

# Create Pull Request

Comprehensive PR creation with validation. All output goes directly to GitHub PR.

## Quick Start

```bash
/create-pr
```

## Workflow

### Phase 1: Pre-Flight Checks

```bash
# Verify branch
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" == "dev" || "$BRANCH" == "main" ]]; then
  echo "Cannot create PR from dev/main. Create a feature branch first."
  exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo "Uncommitted changes detected. Commit or stash first."
  exit 1
fi

# Push branch if needed
git fetch origin
if ! git rev-parse --verify origin/$BRANCH &>/dev/null; then
  git push -u origin $BRANCH
fi
```

### Phase 2: Run Local Validation

```bash
# Backend
cd backend
poetry run ruff format --check app/
poetry run ruff check app/
poetry run pytest tests/unit/ -v --tb=short -x

# Frontend
cd ../frontend
npm run lint && npm run typecheck
```

### Phase 3: Gather Context

```bash
BRANCH=$(git branch --show-current)
ISSUE=$(echo $BRANCH | grep -oE '[0-9]+' | head -1)

git log --oneline dev..HEAD
git diff dev...HEAD --stat
```

### Phase 4: Create PR

```bash
TYPE="feat"  # Determine: feat/fix/refactor/docs/test/chore

gh pr create --base dev \
  --title "$TYPE(#$ISSUE): Brief description" \
  --body "## Summary
[1-2 sentence description]

## Changes
- [Change 1]
- [Change 2]

## Test Plan
- [x] Unit tests pass
- [x] Lint/type checks pass

Closes #$ISSUE

---
Generated with [Claude Code](https://claude.com/claude-code)"
```

### Phase 5: Verify

```bash
PR_URL=$(gh pr view --json url -q .url)
echo "PR created: $PR_URL"
gh pr view --web
```

## Rules

1. **NO junk files** - Don't create files in repo root
2. **Run validation locally** - Don't spawn agents for lint/test
3. **All content goes to GitHub** - PR body via `gh pr create --body`
4. **Keep it simple** - One command to create PR

## Agent Usage

Only use Task agents for:
- Complex code analysis requiring multiple files
- Security review of sensitive changes
- Architecture review for large refactors

## Related Skills
- commit: Create commits before PRs
- review-pr: Review PRs after creation
## References

- [PR Template](references/pr-template.md)