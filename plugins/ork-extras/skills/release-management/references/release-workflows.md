# Release Workflows

## Standard Release

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

## Hotfix Release

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
