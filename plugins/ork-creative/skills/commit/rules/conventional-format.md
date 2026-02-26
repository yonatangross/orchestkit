---
title: Format commit messages with conventional commit prefixes for automated changelogs
impact: HIGH
impactDescription: "Non-conventional messages break automated changelog generation and semantic version bumping"
tags: conventional-commits, format, message, changelog, semver
---

## Conventional Commit Format

All commits must follow the Conventional Commits specification for automated tooling.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
Co-Authored-By: Claude <noreply@anthropic.com>
```

### Types

| Type | When | Bumps |
|------|------|-------|
| `feat` | New feature or capability | MINOR |
| `fix` | Bug fix | PATCH |
| `refactor` | Code restructuring, no behavior change | — |
| `docs` | Documentation only | — |
| `test` | Adding or fixing tests | — |
| `chore` | Build, deps, CI, tooling | — |
| `style` | Formatting, whitespace, semicolons | — |
| `perf` | Performance improvement | PATCH |
| `ci` | CI/CD configuration | — |
| `build` | Build system changes | — |

### Scope

Optional, identifies the area of change:

```bash
# Issue reference (preferred)
feat(#123): Add user authentication

# Module name
fix(auth): Resolve token expiration

# No scope (acceptable for small changes)
chore: Update dependencies
```

### Breaking Changes

Use `!` after type/scope OR `BREAKING CHANGE:` footer:

```bash
# With ! marker (bumps MAJOR)
feat(api)!: Change authentication endpoint structure

# With footer
feat(api): Change auth endpoints

BREAKING CHANGE: /api/auth/login now requires email instead of username
```

### Title Rules

```
[x] Imperative mood ("Add feature" not "Added feature")
[x] No period at end
[x] < 72 characters (< 50 preferred)
[x] Lowercase after colon
[x] Meaningful — describes WHY, not just WHAT
```

**Incorrect:**
```
Fixed the bug.                          # Past tense, period, no type
feat: stuff                             # Vague
feat: Add user authentication and fix billing  # Two concerns
FEAT: Add Auth                          # Uppercase
```

**Correct:**
```
feat(#123): Add JWT token validation for login
fix(#456): Resolve race condition in payment processing
refactor: Extract database connection pool to shared module
```

### Body (Optional)

Use for context that doesn't fit in the title:

```bash
git commit -m "$(cat <<'EOF'
feat(#123): Add rate limiting to API endpoints

Applied token bucket algorithm with 100 req/min per user.
Redis-backed for distributed deployments.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Key Rules

- Type is mandatory — no untyped commits
- Scope with issue number when available (`#123`)
- Title < 72 chars, imperative mood, no period
- One type per commit — if you need `feat` AND `fix`, make two commits
- Always include `Co-Authored-By` when Claude assists
- Breaking changes must use `!` or `BREAKING CHANGE:` footer
