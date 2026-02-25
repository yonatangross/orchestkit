---
title: Multi-Commit PR Guidance
version: 1.0.0
---

# Multi-Commit PR Guidance

## When PRs Have Multiple Commits

Most PRs should have a clean commit history. The PR title summarizes the overall change; individual commits tell the story of how you got there.

## Gathering Context

Before writing the PR body, review the full commit history:

```bash
BRANCH=$(git branch --show-current)
ISSUE=$(echo "$BRANCH" | grep -oE '[0-9]+' | head -1)

# See all commits on this branch
git log --oneline dev..HEAD

# See overall diff stats
git diff dev...HEAD --stat

# See full diff for PR body writing
git diff dev...HEAD
```

## PR Body for Multi-Commit PRs

When the PR has multiple commits, the Changes section should group by logical area, not list each commit:

```markdown
## Summary
Implement user authentication with JWT tokens.

## Changes

### Backend
- Add JWT token generation and validation
- Create login/logout API endpoints
- Add auth middleware for protected routes

### Frontend
- Create login form component
- Add auth context provider
- Implement protected route wrapper

### Infrastructure
- Add JWT_SECRET to environment config
- Update Docker compose with auth service

## Commit History
- `abc1234` feat: add JWT auth backend
- `def5678` feat: add login form frontend
- `ghi9012` chore: configure JWT environment
- `jkl3456` test: add auth integration tests
```

## Squash vs Merge

- **Squash merge**: All commits become one. PR title becomes the commit message. Best for feature branches.
- **Merge commit**: Preserves individual commits. Best when commit history is clean and tells a story.
- **Rebase merge**: Linear history. Best for small, single-commit PRs.

Let the repository's merge strategy setting guide this — do not override per-PR unless there is a reason.
