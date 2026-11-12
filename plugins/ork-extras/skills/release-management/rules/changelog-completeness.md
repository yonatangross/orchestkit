---
title: Changelog must document all breaking changes with migration instructions
impact: HIGH
impactDescription: "Missing breaking changes in changelog causes upgrade failures and erodes trust in release documentation"
tags: [release, changelog, breaking-changes, documentation]
---

# Changelog Must Include All Breaking Changes

## Why

Developers read changelogs before upgrading. If a breaking change is missing from the changelog, they upgrade without migration steps and hit runtime errors. After one bad experience, teams stop upgrading and fall behind on security patches.

## Rule

Before publishing a release:
1. Cross-reference all commits with the changelog
2. Every commit with `!` or `BREAKING CHANGE` must appear in the changelog
3. Breaking changes must include migration instructions
4. The Breaking Changes section must appear first in the changelog

## Incorrect — incomplete changelog missing breaking changes

```markdown
# Changelog

## [2.0.0] - 2026-03-10

### Added
- Bulk export endpoint (#234)
- Dark mode support (#236)

### Fixed
- Date parser null handling (#235)
```

**Problems:**
- Version is 2.0.0 (major) but no breaking changes listed
- The commit `feat!: remove /v1/users endpoint (#230)` is missing
- The commit `refactor!: rename User model to Account (#232)` is missing
- No migration instructions for breaking changes

## Correct — complete changelog with migration instructions

```markdown
# Changelog

## [2.0.0] - 2026-03-10

### BREAKING CHANGES

- **Removed `/v1/users` endpoint** (#230): The deprecated v1 users
  API has been removed. Migrate to `/v2/users` which supports
  cursor-based pagination.

  ```diff
  - GET /v1/users?page=2&limit=20
  + GET /v2/users?cursor=abc123&limit=20
  ```

- **Renamed `User` model to `Account`** (#232): All database tables
  and API responses now use `Account`. Run the migration:

  ```bash
  npm run migrate:up
  ```

  Update imports:
  ```diff
  - import { User } from "./models/user";
  + import { Account } from "./models/account";
  ```

### Added
- Bulk export endpoint (#234)
- Dark mode support (#236)

### Fixed
- Date parser null handling (#235)
```

## Verification Script

```bash
#!/bin/bash
LAST_TAG=$(gh release view --json tagName -q .tagName)

# Find all breaking change commits
BREAKING=$(git log "$LAST_TAG"..HEAD --oneline --format="%s" \
  | grep -E '!:|BREAKING CHANGE')

if [ -z "$BREAKING" ]; then
  echo "No breaking changes found"
  exit 0
fi

echo "Breaking changes to verify in CHANGELOG.md:"
echo "$BREAKING" | while IFS= read -r commit; do
  # Extract PR number if present
  PR=$(echo "$commit" | grep -oE '#[0-9]+' | head -1)
  if [ -n "$PR" ] && ! grep -q "$PR" CHANGELOG.md; then
    echo "  MISSING: $commit"
  else
    echo "  OK: $commit"
  fi
done
```

## Changelog Section Order

| Section | Required When | Position |
|---------|--------------|----------|
| BREAKING CHANGES | Any `!` or `BREAKING CHANGE` commit | First |
| Deprecated | Deprecation notices | Second |
| Added | New features | Third |
| Changed | Behavior changes | Fourth |
| Fixed | Bug fixes | Fifth |
| Security | CVE patches | Sixth |
