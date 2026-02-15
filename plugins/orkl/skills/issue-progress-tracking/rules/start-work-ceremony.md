---
title: Start Work Ceremony
impact: HIGH
impactDescription: "Without this ceremony, team loses visibility into active work and branches lack issue traceability."
tags: github, issues, branching, labels
---

## Start Work Ceremony

Before writing any code, signal intent and create an isolated branch.

**Incorrect:**
```bash
# Jump straight into coding on main
git checkout main
# ... make changes ...
git commit -m "fix stuff"
```

**Correct:**
```bash
# 1. Update issue status
gh issue edit 123 --add-label "status:in-progress" --remove-label "status:todo"

# 2. Comment your intent
gh issue comment 123 --body "Starting work on this issue."

# 3. Branch from default branch
git checkout main && git pull origin main
git checkout -b issue/123-add-user-auth
```

**Key rules:**
- Always pull latest default branch before branching
- Branch name format: `issue/<number>-<brief-kebab-description>`
- Label the issue before starting work — prevents duplicate effort
- Comment briefly what approach you plan to take
