---
title: Make small commits with issue references to maintain traceability and enable bisect
impact: HIGH
impactDescription: "Large commits without issue references break traceability, make reviews harder, and prevent git bisect."
tags: git, commits, issues, traceability
---

## Small Commits with Issue References

Commit after each logical step. Every commit references the issue number.

**Incorrect:**
```bash
# One giant commit at the end
git add .
git commit -m "implement feature"
```

**Correct:**
```bash
# Commit after each logical step
git commit -m "feat(#123): add user model and migration"
git commit -m "feat(#123): add authentication endpoint"
git commit -m "test(#123): add auth endpoint tests"
```

**Key rules:**
- One logical change per commit (schema, endpoint, tests = separate commits)
- Always include `#N` in the commit message to link to the issue
- Use conventional commit format: `type(#N): description`
- Commit before switching context — don't lose work in unstaged changes
- If a commit touches more than 3 files in different domains, it is probably too large
