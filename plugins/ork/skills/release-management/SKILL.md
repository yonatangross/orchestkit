---
name: release-management
license: MIT
compatibility: "Claude Code 2.1.76+. Requires gh CLI."
description: GitHub release workflow with semantic versioning, changelogs, and release automation using gh CLI. Use when creating releases, tagging versions, or publishing changelogs.
context: fork
version: 1.0.0
author: OrchestKit
tags: [git, github, releases, versioning, changelog, automation]
user-invocable: false
disable-model-invocation: true
complexity: low
effort: low
model: haiku
metadata:
  category: document-asset-creation
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - TaskCreate
  - TaskUpdate
  - TaskList
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

### Verify Releases (gh CLI 2.86.0+)

```bash
# Verify release attestation (sigstore)
gh release verify v1.2.0

# Verify specific asset
gh release verify-asset v1.2.0 ./dist/app.zip

# Verify with custom trust policy
gh release verify v1.2.0 --owner myorg
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

```text
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

## Release Workflows

Standard and hotfix release procedures using git tags and `gh release`.

Load Read("${CLAUDE_SKILL_DIR}/references/release-workflows.md") for step-by-step standard and hotfix release workflows.

---

## Changelog Generation

Auto-generated from PRs, custom `.github/release.yml` templates, and manual CHANGELOG.md format.

Load Read("${CLAUDE_SKILL_DIR}/references/changelog-generation.md") for changelog template examples and Keep-a-Changelog format.

---

## Release Automation & Checklist

GitHub Actions workflow for tag-triggered releases, version bumping script, and pre/post-release checklist.

Load Read("${CLAUDE_SKILL_DIR}/references/release-automation.md") for CI workflow, bump script, and release checklist.

---

## Best Practices

1. **Use semantic versioning** - Communicate change impact
2. **Draft releases first** - Review notes before publishing
3. **Generate notes from PRs** - Accurate, automatic history
4. **Close milestone on release** - Track completion
5. **Tag main only** - Never tag feature branches
6. **Announce breaking changes** - Prominent in release notes

## Related Skills

- `ork:github-operations`: Milestones, issues, and CLI reference
- `ork:github-operations`: Branch management and git operations

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")`:

| File | Content |
|------|---------|
| `semver.md` | Semantic versioning rules and decision tree |
| `release-workflows.md` | Standard and hotfix release procedures |
| `changelog-generation.md` | Auto-generated, template, and manual changelog formats |
| `release-automation.md` | GitHub Actions workflow, bump script, and checklist |
