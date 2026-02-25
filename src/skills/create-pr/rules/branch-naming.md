---
title: "Branch Naming Conventions"
impact: "MEDIUM"
impactDescription: "Non-standard branch names break issue auto-linking and CI branch filters"
tags: [pr, branch, naming, git]
---

## Branch Naming Conventions

Branch names enable automated issue extraction and PR categorization.

**Pattern:** `<type>/<issue>-<short-description>`

**Examples:**
```
feat/123-user-profile-page
fix/456-login-race-condition
refactor/789-extract-auth-module
chore/update-deps
docs/improve-api-docs
```

**Key rules:**
- Use lowercase with hyphens (no underscores, no camelCase)
- Include issue number when one exists
- Keep description to 3-5 words
- Type prefix matches conventional commit types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- Protected branches (`main`, `dev`) cannot be PR source branches

**Issue extraction:**
```bash
# Extract issue number from branch name
BRANCH=$(git branch --show-current)
ISSUE=$(echo "$BRANCH" | grep -oE '[0-9]+' | head -1)
```

**Edge cases:**
- No issue: omit number — `chore/update-deps`
- Multiple issues: use primary issue number, mention others in PR body
- Long descriptions: truncate — branch names are for identification, not documentation
