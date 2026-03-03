---
title: Release Checklist Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Build and Test Gates (gates-build) — CRITICAL — 1 rule

All four pre-release checks — build, full test suite, security tests, TypeScript — must pass in order before any staging or tagging.

- `gate-build-and-test.md` — Gate sequence, pass/fail criteria, recovery steps for each check

## 2. Count Validation and Diff Review (gates-counts) — HIGH — 1 rule

After gates pass, verify hook/skill/agent counts are consistent across the `ork` plugin, then review the full diff for secrets, no-op edits, and forbidden direct edits to `plugins/`.

- `gate-counts-and-diff.md` — Count validation command, diff review checklist, forbidden file patterns

## 3. Release Staging Rules (staging) — HIGH — 1 rule

How to stage exactly the right files for a release commit: version consistency checks, why `git add -A` is forbidden, and the expected file list.

- `commit-staging.md` — Version consistency checks, explicit staging commands, expected files table

## 4. Commit, Tag, and Push (commit-push) — HIGH — 1 rule

Conventional commit format for release commits, annotated tag naming, and the rule that `git push --follow-tags` always requires explicit user confirmation.

- `commit-tag-push.md` — Commit format with Co-Authored-By, tag naming, push confirmation requirement
