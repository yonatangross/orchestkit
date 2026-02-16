---
title: Atomic Commit Rules
impact: CRITICAL
impactDescription: "Non-atomic commits make git bisect useless, reverts dangerous, and PRs unreviewable"
tags: atomic, commit, single-concern, related-changes
---

## Atomic Commit Rules

A commit is atomic when it contains exactly ONE logical change that can be understood, reviewed, and reverted independently.

### The Atomicity Test

A commit is atomic if ALL of these are true:

```
[x] Does ONE logical thing
[x] Leaves the codebase in a working state (tests pass)
[x] Commit message doesn't need "and" in the title
[x] Can be reverted independently without breaking other features
[x] A reviewer can understand the full change without external context
```

### Detection Heuristics

**Directory Spread** — Changes spanning unrelated directories signal mixed concerns:

```
# ATOMIC: Related files in same domain
src/auth/login.ts
src/auth/login.test.ts
src/auth/types.ts

# NOT ATOMIC: Unrelated directories
src/auth/login.ts        ← auth feature
src/billing/invoice.ts   ← billing feature
config/webpack.config.js ← build config
```

**Commit Type Mixing** — A single commit shouldn't mix types:

```
# NOT ATOMIC: feat + fix in one commit
feat: Add user dashboard
fix: Resolve login timeout     ← separate commit

# NOT ATOMIC: feat + chore in one commit
feat: Add API caching
chore: Update eslint config     ← separate commit
```

**File Count Threshold** — More than 10 staged files warrants inspection. Not always wrong, but should be verified:

```
# OK: 15 files, all test fixtures for one feature
tests/fixtures/user-*.json (15 files)

# NOT OK: 12 files across 6 unrelated modules
```

**"And" Test** — If describing the commit requires "and", it's two commits:

```
# Fails "and" test → split it
"Add user authentication AND fix logging format"

# Passes "and" test → atomic
"Add JWT token validation for login endpoint"
```

### Common Atomic Patterns

| Pattern | Files | Why Atomic |
|---------|-------|------------|
| Feature + its tests | `feature.ts` + `feature.test.ts` | Tests validate the feature |
| Migration + model update | `migration.sql` + `model.ts` | Schema change is one concern |
| Refactor across files | Multiple files, same pattern | One refactoring decision |
| Config change | `.env.example` + `config.ts` | One configuration concern |
| Dependency update | `package.json` + `package-lock.json` | One dependency decision |

### Common Non-Atomic Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| Feature + unrelated fix | Two concerns | Two separate commits |
| Code change + formatting | Formatting is noise | Format first, then change |
| Multiple features | Can't revert independently | One commit per feature |
| Feature + config change | Different review concerns | Separate unless config IS the feature |

**Incorrect — non-atomic commit mixing concerns:**
```bash
# Mixed commit spanning unrelated areas
git add src/auth/login.ts \
        src/billing/invoice.ts \
        config/webpack.config.js
git commit -m "feat: Add login AND fix invoice AND update webpack"
# Three unrelated changes - can't revert independently!
```

**Correct — atomic commits with single concerns:**
```bash
# Commit 1: Auth feature + its tests (related)
git add src/auth/login.ts src/auth/login.test.ts
git commit -m "feat(#123): Add JWT token validation for login endpoint"

# Commit 2: Billing feature + its tests (related)
git add src/billing/invoice.ts src/billing/invoice.test.ts
git commit -m "feat(#124): Add invoice generation service"

# Commit 3: Config change (separate concern)
git add config/webpack.config.js
git commit -m "chore: Update webpack for tree shaking"
```

### Key Rules

- One logical change per commit — if you say "and", split it
- Tests belong with the code they test — same commit
- Formatting/linting changes are separate commits
- Database migrations go with the code that uses them
- Never mix feature work with unrelated refactoring
