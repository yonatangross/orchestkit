---
description: Walks through the OrchestKit release checklist - build, test, validate counts, changelog, version bump, commit, tag, push. Use when preparing a release or verifying release readiness.
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Auto-generated from skills/release-checklist/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Release Checklist

Sequential release gate. Stop on first failure, suggest fix, report `[PASS]` or `[FAIL]` for each step.

## Rules

| Rule | File | Key Constraint |
|------|------|----------------|
| Gate ordering | `rules/gate-ordering.md` | Steps must run in sequence; stop on first FAIL |
| Version consistency | `rules/version-consistency.md` | package.json and CLAUDE.md must match |
| Push confirmation | `rules/push-confirmation.md` | Always confirm before git push |

## References

- [Release phase overview](references/release-phases.md)

## Quick Reference

Run `scripts/release-preflight.sh` to execute steps 1–5 automatically. Steps 6–12 require human judgment.

## Steps

| # | Step | Command | Pass Condition |
|---|------|---------|----------------|
| 1 | Build | `npm run build` | plugins/ populated, no errors |
| 2 | Tests | `npm test` | All suites green |
| 3 | Security | `npm run test:security` | Must pass — no exceptions |
| 4 | TypeScript | `npm run typecheck` | Zero type errors |
| 5 | Counts | `/validate-counts` | All counts consistent |
| 6 | Changelog | Read CHANGELOG.md | Entry exists for this version |
| 7 | Version | Read package.json + CLAUDE.md | Both match release version |
| 8 | Diff review | `git diff` | Only expected changes |
| 9 | Stage | `git add <files>` | Specific files staged |
| 10 | Commit | `git commit -m "release: vX.Y.Z"` | Conventional format |
| 11 | Tag | `git tag vX.Y.Z` | Matches package.json version |
| 12 | Push | `git push --follow-tags` | **Confirm with user first** |
