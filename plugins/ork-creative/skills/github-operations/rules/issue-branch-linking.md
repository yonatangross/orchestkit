---
title: Linking Issues to Branches and PRs
impact: MEDIUM
impactDescription: "Unlinked issues and PRs break traceability — reviewers lack context and issues stay open after merging fixes"
tags: github, issues, branches, pr, linking, traceability
---

## Linking Issues to Branches and PRs

Establish bidirectional links between issues, branches, commits, and PRs for full traceability and automatic issue closure.

### Branch Naming Convention

```bash
# Pattern: {type}/{issue-number}-{description}
issue/123-implement-feature
fix/456-resolve-timeout-bug
feature/789-add-search-api

# Creates automatic link: branch -> issue
```

### Commit Linking

```bash
# Reference in commit message
git commit -m "feat(#123): Add user validation"

# Auto-close keywords (in commit or PR body)
git commit -m "fix: Resolve timeout (closes #456)"
git commit -m "feat: Add search (fixes #789)"
```

### PR Linking

```bash
# Create PR that auto-closes issue on merge
gh pr create --title "feat(#123): Add search" \
  --body "Closes #123

## Changes
- Added search API endpoint
- Added search UI component"

# Link existing PR to issue
gh issue edit 123 --add-label "has-pr"
```

### PR-Aware Session Resumption

```bash
# Resume with full PR context (CC 2.1.27+)
claude --from-pr 42    # Loads PR diff, comments, review status
```

### Linking Checklist

| Link | How | Automatic? |
|------|-----|------------|
| Branch to issue | Branch name `issue/N-*` | Yes (hooks) |
| Commit to issue | `#N` in commit message | Yes (GitHub) |
| PR to issue | `Closes #N` in PR body | Yes (GitHub) |
| Issue to PR | `has-pr` label | Manual or hook |

**Incorrect — Branch without issue number prefix:**
```bash
git checkout -b implement-feature
git commit -m "Add user validation"
# No automatic linking - reviewer lacks context
```

**Correct — Issue-prefixed branch with linked commit:**
```bash
git checkout -b issue/123-implement-feature
git commit -m "feat(#123): Add user validation"
# Auto-links: branch → issue, commit → issue
```

### Key Rules

- Always start branches with **issue number prefix** for automatic detection
- Use **`Closes #N`** in PR body for automatic issue closure on merge
- Include **`#N`** in every commit that relates to an issue
- Use **conventional commit format** for consistent linking
- Add **`has-pr` label** to issues when a PR is created
- Use **`--from-pr`** to resume sessions with full PR context
