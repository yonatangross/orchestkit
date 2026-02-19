---
title: Release Phases Overview
tags: [release, phases, overview]
---

# Release Phases Overview

The release checklist is organized into three phases:

## Phase 1: Verification (Steps 1–5)

Automated checks that must pass before any human review. Run `scripts/release-preflight.sh` to execute all of these.

- **Build** — ensures plugins/ is generated from current src/
- **Tests** — all test suites pass
- **Security** — MUST pass, no exceptions
- **TypeScript** — no type errors in hooks
- **Counts** — manifests match actual file counts

## Phase 2: Human Review (Steps 6–8)

Requires human judgment to verify content correctness:

- **Changelog** — release notes are accurate and complete
- **Version** — version numbers are bumped consistently
- **Diff** — no unintended changes, no secrets, no debug artifacts

## Phase 3: Publish (Steps 9–12)

Irreversible operations. Stage → commit → tag → push.

- Stage only specific files (never `git add -A` for releases)
- Commit with conventional `release: vX.Y.Z` message
- Tag must match package.json version exactly
- Push requires explicit user confirmation (see `rules/push-confirmation.md`)
