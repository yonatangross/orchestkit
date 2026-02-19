---
title: Version Consistency
impact: HIGH
tags: [release, version, consistency]
---

# Version Consistency

## Rule

The release version must match in **both** of these files before tagging:

| File | Field | Example |
|------|-------|---------|
| `package.json` | `"version"` | `"6.0.21"` |
| `CLAUDE.md` | `**Current**: X.Y.Z` line | `**Current**: 6.0.21` |

## Check Method

```bash
PKG_VERSION=$(node -p "require('./package.json').version")
CLAUDE_VERSION=$(grep -o 'Current.*: [0-9.]*' CLAUDE.md | grep -o '[0-9.]*')
echo "package.json: $PKG_VERSION"
echo "CLAUDE.md:    $CLAUDE_VERSION"
[ "$PKG_VERSION" = "$CLAUDE_VERSION" ] && echo "MATCH" || echo "MISMATCH — fix before tagging"
```

## Tag Must Match

The git tag (`vX.Y.Z`) must exactly match `package.json` version with a `v` prefix:

```bash
git tag "v$(node -p "require('./package.json').version")"
```
