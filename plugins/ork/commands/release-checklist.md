---
description: Walks through the OrchestKit release checklist — build, test, validate counts, changelog, version bump, commit, tag, push. Use when preparing a release, cutting a version tag, or verifying release readiness before pushing to main.
allowed-tools: [Bash, Read, Write, Edit, Glob, Grep]
---

# Auto-generated from skills/release-checklist/SKILL.md
# Source: https://github.com/yonatangross/orchestkit


# Release Checklist

Sequential release gate for OrchestKit. Each step reports `[PASS]` or `[FAIL]`. Stop on first failure, suggest a fix, then continue after user confirmation.

See [references/release-flow.md](references/release-flow.md) for why the order matters and hotfix guidance.

## Quick Reference

| Category | Rules | Impact | When to Use |
|----------|-------|--------|-------------|
| [Pre-Release Gates](#pre-release-gates) | 2 | CRITICAL | Before every release commit |
| [Release Commit](#release-commit) | 2 | HIGH | Staging, committing, tagging, pushing |

**Total: 4 rules across 2 categories**

## Pre-Release Gates

Must all pass before writing any release commit. See `rules/gate-build-and-test.md` and `rules/gate-counts-and-diff.md`.

| Step | Command | Rule File |
|------|---------|-----------|
| 1. Build | `npm run build` | `rules/gate-build-and-test.md` |
| 2. Tests | `npm test` | `rules/gate-build-and-test.md` |
| 3. Security | `npm run test:security` | `rules/gate-build-and-test.md` |
| 4. TypeScript | `npm run typecheck` | `rules/gate-build-and-test.md` |
| 5. Validate counts | `/validate-counts` | `rules/gate-counts-and-diff.md` |
| 6. Diff review | `git diff` | `rules/gate-counts-and-diff.md` |

## Release Commit

Steps after all gates pass. See `rules/commit-staging.md` and `rules/commit-tag-push.md`.

| Step | Action | Rule File |
|------|--------|-----------|
| 7. Changelog | Entry exists in `CHANGELOG.md` | `rules/commit-staging.md` |
| 8. Version bump | `package.json` + `CLAUDE.md` both updated | `rules/commit-staging.md` |
| 9. Stage files | `git add <specific files>` — never `-A` | `rules/commit-staging.md` |
| 10. Commit | `release: vX.Y.Z` conventional format | `rules/commit-tag-push.md` |
| 11. Tag | `git tag vX.Y.Z` | `rules/commit-tag-push.md` |
| 12. Push | Run `scripts/pre-push-confirm.sh` — confirm first | `rules/commit-tag-push.md` |

## Common Mistakes

1. Running `npm test` before `npm run build` — tests run against stale dist
2. Using `git add -A` — accidentally stages secrets or unrelated in-progress work
3. Forgetting to bump `CLAUDE.md` version alongside `package.json`
4. Pushing without explicit user confirmation — irreversible on shared remotes
5. Skipping security tests — non-negotiable, even for patch releases
