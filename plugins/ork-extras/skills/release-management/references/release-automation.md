# Release Automation

## GitHub Actions Release Workflow

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
