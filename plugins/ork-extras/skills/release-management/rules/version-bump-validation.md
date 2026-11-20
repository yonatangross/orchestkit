---
title: Validate that semantic version bump matches the actual scope of changes
impact: HIGH
impactDescription: "Wrong version bumps break downstream consumers — a breaking change shipped as patch causes runtime failures for dependents"
tags: [release, versioning, semver, validation]
---

# Validate Version Bump Matches Change Scope

## Why

Semantic versioning is a contract with consumers. A breaking API change shipped as a patch version (1.2.3 -> 1.2.4) causes runtime failures for anyone pinned to `^1.2.3`. A bug fix shipped as major (1.2.3 -> 2.0.0) forces unnecessary migration work.

## Rule

Before tagging a release:
1. List all commits since the last release
2. Classify each commit as patch/minor/major based on its impact
3. The version bump must match the highest-impact commit
4. Breaking changes require major bump — no exceptions

## Incorrect — bump version without checking changes

```bash
# Blindly bump patch without reviewing commits
CURRENT="1.2.3"
NEW="1.2.4"  # Assumed patch

git tag -a "v$NEW" -m "Release v$NEW"
git push origin "v$NEW"
gh release create "v$NEW" --generate-notes

# But commits since v1.2.3 include:
# - "feat!: remove deprecated /v1/users endpoint" (BREAKING)
# - "feat: add /v2/users with pagination" (MINOR)
# - "fix: correct date parsing" (PATCH)
# Correct bump should have been MAJOR (2.0.0)
```

## Correct — classify commits then determine bump

```bash
#!/bin/bash
LAST_TAG=$(gh release view --json tagName -q .tagName)
echo "Commits since $LAST_TAG:"

# Classify commits
MAJOR=0; MINOR=0; PATCH=0

while IFS= read -r msg; do
  if echo "$msg" | grep -qE '^(feat|fix|refactor)(\(.+\))?!:|^BREAKING'; then
    MAJOR=$((MAJOR + 1))
    echo "  MAJOR: $msg"
  elif echo "$msg" | grep -qE '^feat(\(.+\))?:'; then
    MINOR=$((MINOR + 1))
    echo "  MINOR: $msg"
  else
    PATCH=$((PATCH + 1))
    echo "  PATCH: $msg"
  fi
done < <(git log "$LAST_TAG"..HEAD --oneline --format="%s")

# Determine correct bump
if [ "$MAJOR" -gt 0 ]; then
  echo "Required bump: MAJOR ($MAJOR breaking changes)"
elif [ "$MINOR" -gt 0 ]; then
  echo "Required bump: MINOR ($MINOR new features)"
else
  echo "Required bump: PATCH ($PATCH fixes)"
fi
```

## Classification Guide

| Commit Pattern | Bump | Example |
|----------------|------|---------|
| `fix:` | PATCH | `fix: handle null in date parser` |
| `docs:`, `chore:`, `ci:` | PATCH | `docs: update API reference` |
| `feat:` | MINOR | `feat: add bulk export endpoint` |
| `feat!:` or `BREAKING CHANGE:` | MAJOR | `feat!: remove v1 API endpoints` |
| `refactor!:` | MAJOR | `refactor!: rename User to Account` |

## Pre-Release Validation

```bash
# Before creating the release, verify:
echo "=== Pre-Release Checklist ==="
echo "1. Last release: $LAST_TAG"
echo "2. Commits since: $(git rev-list "$LAST_TAG"..HEAD --count)"
echo "3. Breaking changes: $MAJOR"
echo "4. New features: $MINOR"
echo "5. Fixes/chores: $PATCH"
echo "6. Proposed version: v$NEW"
echo ""
if [ "$MAJOR" -gt 0 ] && ! echo "$NEW" | grep -qE '^[0-9]+\.0\.0'; then
  echo "ERROR: Breaking changes found but version is not a major bump"
  exit 1
fi
```
