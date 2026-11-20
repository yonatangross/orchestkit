# Changelog Generation

## Auto-Generated (from PRs)

```bash
# GitHub auto-generates from merged PRs
gh release create v1.2.0 --generate-notes

# Output includes:
# ## What's Changed
# * feat: Add user auth by @dev in #123
# * fix: Login redirect by @dev in #124
# * docs: Update README by @dev in #125
```

## Custom Changelog Template

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

## Manual CHANGELOG.md

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
