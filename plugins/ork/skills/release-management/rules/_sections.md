---
title: Release Management Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Version Integrity (versioning) — HIGH — 1 rule

Validates that the semantic version bump matches the highest-impact commit in the release to protect downstream consumers from broken semver contracts.

- `version-bump-validation.md` — Classify every commit as patch/minor/major; bump must match highest-impact commit; breaking changes require major

## 2. Changelog Completeness (documentation) — HIGH — 1 rule

Ensures all breaking changes appear in the changelog with migration instructions before a release is published.

- `changelog-completeness.md` — Cross-reference commits with changelog; every `!` or `BREAKING CHANGE` commit must have migration instructions in the changelog
