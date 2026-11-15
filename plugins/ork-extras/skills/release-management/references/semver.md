# Semantic Versioning Guide

Standard versioning for software releases.

## Version Format

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]

Examples:
1.0.0
2.1.3
3.0.0-alpha.1
3.0.0-beta.2+build.123
```

## When to Bump

### PATCH (x.x.X)
Bug fixes, backwards compatible:
```
1.0.0 -> 1.0.1
```
- Fix typo in error message
- Fix edge case bug
- Security patch (no API change)
- Performance improvement (no API change)

### MINOR (x.X.0)
New features, backwards compatible:
```
1.0.1 -> 1.1.0
```
- Add new function/method
- Add new optional parameter
- Deprecate (but don't remove) feature
- Add new event/hook

### MAJOR (X.0.0)
Breaking changes:
```
1.1.0 -> 2.0.0
```
- Remove function/method
- Change function signature
- Change return type
- Rename public API
- Change default behavior

## Pre-release Versions

```
2.0.0-alpha.1   # Early development
2.0.0-alpha.2
2.0.0-beta.1    # Feature complete
2.0.0-beta.2
2.0.0-rc.1      # Release candidate
2.0.0-rc.2
2.0.0           # Final release
```

### Precedence
```
1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-beta < 1.0.0-rc.1 < 1.0.0
```

## Decision Tree

```
Is it a breaking change?
├── Yes → MAJOR bump
└── No
    └── Is it a new feature?
        ├── Yes → MINOR bump
        └── No → PATCH bump
```

## Examples

| Change | Version Bump | Reason |
|--------|--------------|--------|
| Fix null pointer crash | 1.0.0 → 1.0.1 | Bug fix |
| Add `sort` parameter | 1.0.1 → 1.1.0 | New feature |
| Change `sort` to required | 1.1.0 → 2.0.0 | Breaking |
| Improve performance 2x | 1.0.0 → 1.0.1 | No API change |
| Remove deprecated method | 1.5.0 → 2.0.0 | Breaking |
| Add new endpoint | 1.0.0 → 1.1.0 | New feature |

## Commands

```bash
# View current version
cat package.json | jq '.version'

# Bump with npm
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.1 -> 1.1.0
npm version major  # 1.1.0 -> 2.0.0

# With git tag
npm version patch -m "Release %s"

# Manual
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

## 0.x.x Versions

For pre-1.0 development:
- API is unstable
- MINOR can include breaking changes
- PATCH for any fixes/features

```
0.1.0  Initial development
0.2.0  Breaking changes OK
0.9.0  Approaching stable
1.0.0  First stable release
```
