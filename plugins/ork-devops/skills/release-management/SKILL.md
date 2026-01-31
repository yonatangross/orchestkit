---
name: release-management
description: GitHub release workflow with semantic versioning, changelogs, and release automation using gh CLI. Use when creating releases, tagging versions, or publishing changelogs.
context: fork
version: 1.0.0
author: OrchestKit
tags: [git, github, releases, versioning, changelog, automation]
user-invocable: false
---

# Release Management

Automate releases with `gh release`, semantic versioning, and changelog generation.

## Quick Reference

### Create Release

```bash
# Auto-generate notes from PRs
gh release create v1.2.0 --generate-notes

# With custom title
gh release create v1.2.0 --title "Version 1.2.0: Performance Update" --generate-notes

# Draft release (review before publishing)
gh release create v1.2.0 --draft --generate-notes

# Pre-release (beta, rc)
gh release create v1.2.0-beta.1 --prerelease --generate-notes

# With custom notes
gh release create v1.2.0 --notes "## Highlights
- New auth system
- 50% faster search"

# From notes file
gh release create v1.2.0 --notes-file RELEASE_NOTES.md
```

### List & View Releases

```bash
# List all releases
gh release list

# View specific release
gh release view v1.2.0

# View in browser
gh release view v1.2.0 --web

# JSON output
gh release list --json tagName,publishedAt,isPrerelease
```

### Manage Releases

```bash
# Edit release
gh release edit v1.2.0 --title "New Title" --notes "Updated notes"

# Delete release
gh release delete v1.2.0

# Upload assets
gh release upload v1.2.0 ./dist/app.zip ./dist/app.tar.gz
```

---

## Semantic Versioning

```
MAJOR.MINOR.PATCH
  │     │     │
  │     │     └── Bug fixes (backwards compatible)
  │     └──────── New features (backwards compatible)
  └────────────── Breaking changes

Examples:
  1.0.0 → 1.0.1  (patch: bug fix)
  1.0.1 → 1.1.0  (minor: new feature)
  1.1.0 → 2.0.0  (major: breaking change)

Pre-release:
  2.0.0-alpha.1  (early testing)
  2.0.0-beta.1   (feature complete)
  2.0.0-rc.1     (release candidate)
```

---

## Release Workflow

### Standard Release

```bash
# 1. Ensure main is up to date
git checkout main
git pull origin main

# 2. Determine version bump
# Check commits since last release
gh release view --json tagName -q .tagName  # Current: v1.2.3
git log v1.2.3..HEAD --oneline

# 3. Create and push tag
git tag -a v1.3.0 -m "Release v1.3.0"
git push origin v1.3.0

# 4. Create GitHub release
gh release create v1.3.0 \
  --title "v1.3.0: Feature Name" \
  --generate-notes

# 5. Close milestone if used
gh api -X PATCH repos/:owner/:repo/milestones/5 -f state=closed
```

### Hotfix Release

```bash
# 1. Branch from release tag
git checkout -b hotfix/v1.2.4 v1.2.3

# 2. Fix and commit
git commit -m "fix: Critical security patch"

# 3. Tag and release
git tag -a v1.2.4 -m "Hotfix: Security patch"
git push origin v1.2.4
gh release create v1.2.4 --title "v1.2.4: Security Hotfix" \
  --notes "Critical security fix for authentication bypass"

# 4. Merge fix to main
git checkout main
git cherry-pick <commit-sha>
git push origin main
```

---

## Changelog Generation

### Auto-Generated (from PRs)

```bash
# GitHub auto-generates from merged PRs
gh release create v1.2.0 --generate-notes

# Output includes:
# ## What's Changed
# * feat: Add user auth by @dev in #123
# * fix: Login redirect by @dev in #124
# * docs: Update README by @dev in #125
```

### Custom Changelog Template

Create `.github/release.yml`:

```yaml
changelog:
  categories:
    - title: "Breaking Changes"
      labels:
        - "breaking"
    - title: "New Features"
      labels:
        - "enhancement"
        - "feature"
    - title: "Bug Fixes"
      labels:
        - "bug"
        - "fix"
    - title: "Documentation"
      labels:
        - "documentation"
    - title: "Other Changes"
      labels:
        - "*"
```

### Manual CHANGELOG.md

```markdown
# Changelog

## [1.3.0] - 2026-01-15

### Added
- User authentication system (#123)
- Dark mode support (#125)

### Changed
- Improved search performance (#126)

### Fixed
- Login redirect loop (#124)

### Security
- Updated dependencies for CVE-2026-1234
```

---

## Automation with GitHub Actions

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build
        run: npm run build

      - name: Create Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release create ${{ github.ref_name }} \
            --generate-notes \
            ./dist/*.zip
```

---

## Version Bumping Script

```bash
#!/bin/bash
# bump-version.sh

CURRENT=$(gh release view --json tagName -q .tagName | sed 's/v//')
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case $1 in
  major) NEW="$((MAJOR + 1)).0.0" ;;
  minor) NEW="$MAJOR.$((MINOR + 1)).0" ;;
  patch) NEW="$MAJOR.$MINOR.$((PATCH + 1))" ;;
  *) echo "Usage: $0 [major|minor|patch]"; exit 1 ;;
esac

echo "Bumping $CURRENT -> $NEW"
git tag -a "v$NEW" -m "Release v$NEW"
git push origin "v$NEW"
gh release create "v$NEW" --generate-notes
```

Usage:
```bash
./bump-version.sh patch  # 1.2.3 -> 1.2.4
./bump-version.sh minor  # 1.2.4 -> 1.3.0
./bump-version.sh major  # 1.3.0 -> 2.0.0
```

---

## Release Checklist

```markdown
## Release v1.3.0 Checklist

### Pre-Release
- [ ] All PRs merged to main
- [ ] CI/CD passing on main
- [ ] Version numbers updated in package.json/pyproject.toml
- [ ] CHANGELOG.md updated
- [ ] Documentation updated
- [ ] Milestone closed

### Release
- [ ] Tag created and pushed
- [ ] GitHub release created
- [ ] Release notes reviewed
- [ ] Assets uploaded (if applicable)

### Post-Release
- [ ] Deployment verified
- [ ] Announcement posted (if applicable)
- [ ] Next milestone created
```

---

## Best Practices

1. **Use semantic versioning** - Communicate change impact
2. **Draft releases first** - Review notes before publishing
3. **Generate notes from PRs** - Accurate, automatic history
4. **Close milestone on release** - Track completion
5. **Tag main only** - Never tag feature branches
6. **Announce breaking changes** - Prominent in release notes

## Related Skills

- github-operations: Milestones, issues, and CLI reference
- git-workflow: Branching and recovery patterns

## References

- [Semantic Versioning](references/semver.md)
- [Release Automation](references/release-automation.md)
