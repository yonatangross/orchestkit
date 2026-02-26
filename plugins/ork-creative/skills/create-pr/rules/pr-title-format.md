---
title: "PR Title Format"
impact: "HIGH"
impactDescription: "Bad titles break changelog generation and make PR lists unreadable"
tags: [pr, title, conventional]
---

## PR Title Format

PR titles must be concise, scannable, and follow conventional commit prefixes for automated tooling.

**Incorrect:**
```
Updated the user profile page to add avatar upload functionality and fixed a bug
```

**Correct:**
```
feat(#456): add user profile page with avatar upload
```

**Key rules:**
- Under 70 characters total (GitHub truncates at ~72)
- Use conventional prefix: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, `perf`
- Include issue number in scope when available: `feat(#123): ...`
- Use imperative mood: "add", "fix", "update" (not "added", "fixes", "updating")
- No trailing period
- Lowercase after prefix (unless proper noun)

**Prefix selection:**

| Prefix | Use when |
|--------|----------|
| `feat` | New user-facing functionality |
| `fix` | Bug fix for existing behavior |
| `refactor` | Code change with no behavior change |
| `docs` | Documentation only |
| `test` | Test additions or corrections |
| `chore` | Build, CI, dependency updates |
| `ci` | CI configuration changes |
| `perf` | Performance improvement |

**Edge cases:**
- Breaking changes: add `!` after scope — `feat(#123)!: redesign auth flow`
- Multiple issues: use primary issue — `fix(#123): resolve race condition`
- No issue: omit scope parens — `chore: update dependencies`
