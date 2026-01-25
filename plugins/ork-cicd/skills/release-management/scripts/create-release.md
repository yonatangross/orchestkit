---
name: create-release
description: Create a GitHub release with auto-detected version and changelog. Use when creating new releases.
user-invocable: true
argument-hint: [version]
allowed-tools: Bash, Read, Grep, Glob
---

Create release: $ARGUMENTS

## Release Context (Auto-Detected)

- **Current Version**: !`git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0"`
- **Last Release Date**: !`git log -1 --format=%ai $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD") 2>/dev/null || echo "Unknown"`
- **Commits Since Last Release**: !`git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~10")..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **Current Branch**: !`git branch --show-current || echo "main"`
- **Changed Files**: !`git diff --name-only $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~10")..HEAD 2>/dev/null | head -20 || echo "No changes detected"`
- **GitHub CLI Available**: !`which gh >/dev/null 2>&1 && echo "✅ Yes" || echo "❌ Not found"`

## Release Information

**Version**: $ARGUMENTS
**Tag**: v$ARGUMENTS

## Recent Changes

!`git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~10")..HEAD --format="- %s (%h)" 2>/dev/null | head -30 || echo "No recent commits"`

## Release Checklist

- [ ] Version number confirmed: **$ARGUMENTS**
- [ ] All tests passing
- [ ] Changelog updated
- [ ] Version files updated (package.json, pyproject.toml, etc.)
- [ ] Branch is clean (no uncommitted changes)
- [ ] On main/master branch

## Create Release

Run the following to create the release:

```bash
# Create and push tag
git tag -a "v$ARGUMENTS" -m "Release v$ARGUMENTS"
git push origin "v$ARGUMENTS"

# Create GitHub release
gh release create "v$ARGUMENTS" \
  --title "Release v$ARGUMENTS" \
  --notes "$(git log $(git describe --tags --abbrev=0 2>/dev/null || echo "HEAD~10")..HEAD --format='- %s' 2>/dev/null || echo 'Release notes')"
```

Or use the release workflow script:
```bash
source scripts/release-scripts.sh
create_release "$ARGUMENTS" "Release v$ARGUMENTS"
```
