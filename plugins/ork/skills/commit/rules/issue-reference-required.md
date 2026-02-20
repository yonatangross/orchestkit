---
title: Include issue references in commits to maintain traceability to GitHub issues
impact: HIGH
impactDescription: "Missing issue references break traceability between commits and GitHub issues"
tags: issue-reference, traceability, commit-message, github
---

## Issue Reference Required

When on an issue branch (`issue/*`, `fix/*`, `feat/*`), commit messages MUST reference the issue number using `#N` format.

### Why

- Links commits to issues automatically in GitHub
- Enables automated issue closing via `Closes #N` or `Fixes #N`
- Provides traceability for code review and auditing

### Good Examples

```bash
# Issue number in scope
git commit -m "fix(#42): resolve null pointer in auth handler"

# Issue number in body
git commit -m "feat(auth): add OAuth2 support

Implements #42"

# Closing reference
git commit -m "fix(api): validate input length

Closes #42"
```

### Bad Examples

```bash
# No issue reference on an issue branch
git commit -m "fix: resolve null pointer in auth handler"

# Issue number without # prefix
git commit -m "fix(42): resolve null pointer"
```

### When to Apply

- **Always** when the branch name contains an issue number (e.g., `issue/42-fix-auth`, `fix/42-null-pointer`)
- **Recommended** for any branch linked to a known GitHub issue
- **Skip** for branches unrelated to issues (e.g., `chore/update-deps`)

**Incorrect — missing issue reference on issue branch:**
```bash
# On branch: issue/42-fix-auth
# No issue reference - breaks traceability!
git commit -m "fix: resolve null pointer in auth handler"
```

**Correct — issue reference in commit message:**
```bash
# On branch: issue/42-fix-auth
# Issue number in scope
git commit -m "fix(#42): resolve null pointer in auth handler"

# Or in body
git commit -m "fix(auth): resolve null pointer in auth handler

Fixes #42"
```

### Soft Rule

This is a soft rule enforced by the `issue-reference-checker` hook, which nudges the developer to add the reference. The commit will not be blocked if the reference is missing.
