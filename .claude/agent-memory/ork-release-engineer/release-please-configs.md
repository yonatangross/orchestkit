# Release-Please Configuration Reference

Concrete config examples for different release strategies.

## Current OrchestKit Config (Branch-Based Pre-Release)

File: `.release-please-config.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "simple",
  "include-component-in-tag": false,
  "changelog-sections": [
    { "type": "feat", "section": "Features", "hidden": false },
    { "type": "fix", "section": "Bug Fixes", "hidden": false },
    { "type": "chore", "section": "Miscellaneous", "hidden": false },
    { "type": "docs", "section": "Documentation", "hidden": false },
    { "type": "refactor", "section": "Code Refactoring", "hidden": false },
    { "type": "perf", "section": "Performance", "hidden": false },
    { "type": "ci", "section": "CI/CD", "hidden": false }
  ],
  "bootstrap-sha": "c5fbeca5028a6cb309cef3bb1f2d6cc7c2f2ddfa",
  "packages": {
    ".": {
      "extra-files": [
        { "type": "json", "path": "package.json", "jsonpath": "$.version" },
        { "type": "json", "path": ".claude-plugin/marketplace.json", "jsonpath": "$.version" },
        { "type": "json", "path": ".claude-plugin/marketplace.json", "jsonpath": "$.plugins[0].version" },
        { "type": "json", "path": "manifests/ork.json", "jsonpath": "$.version" },
        { "type": "json", "path": "plugins/ork/.claude-plugin/plugin.json", "jsonpath": "$.version" },
        { "type": "generic", "path": "pyproject.toml" },
        { "type": "generic", "path": "CLAUDE.md" }
      ]
    }
  }
}
```

**Strategy:** Manual pre-release via `prerelease.yml` + automatic stable via `release-please.yml`.

---

## Option A: Stable Releases Only (Simple)

Use this if NOT using pre-releases.

```json
{
  "release-type": "simple",
  "include-component-in-tag": false,
  "changelog-sections": [
    { "type": "feat", "section": "Features", "hidden": false },
    { "type": "fix", "section": "Bug Fixes", "hidden": false }
  ],
  "packages": {
    ".": {
      "extra-files": [
        { "type": "json", "path": "package.json", "jsonpath": "$.version" }
      ]
    }
  }
}
```

---

## Option B: Branch-Based Pre-Release with release-please

Use this to make release-please handle pre-releases automatically.

```json
{
  "release-type": "simple",
  "include-component-in-tag": false,
  "separate-pull-requests": true,
  "branches": [
    {
      "branch": "main",
      "channel": "latest"
    },
    {
      "branch": "next",
      "channel": "beta",
      "prerelease-type": "beta"
    },
    {
      "branch": "alpha",
      "channel": "alpha",
      "prerelease-type": "alpha"
    }
  ],
  "changelog-sections": [
    { "type": "feat", "section": "Features", "hidden": false },
    { "type": "fix", "section": "Bug Fixes", "hidden": false },
    { "type": "chore", "section": "Miscellaneous", "hidden": false }
  ],
  "packages": {
    ".": {
      "extra-files": [
        { "type": "json", "path": "package.json", "jsonpath": "$.version" },
        { "type": "generic", "path": "pyproject.toml" }
      ]
    }
  }
}
```

**Workflow:**
- Push to `main` → v7.1.11 (stable release)
- Push to `next` → v8.0.0-beta.1 (pre-release)
- Push to `alpha` → v8.0.0-alpha.1 (early access)

**GitHub Actions:**
```yaml
# .github/workflows/release-please.yml
on:
  push:
    branches: [main, next, alpha]
```

---

## Option C: Monorepo with Pre-Releases

Use this for multiple packages with different release tracks.

```json
{
  "release-type": "node",
  "separate-pull-requests": true,
  "branches": [
    { "branch": "main", "channel": "latest" },
    { "branch": "next", "channel": "beta", "prerelease-type": "beta" }
  ],
  "packages": {
    "packages/core": {},
    "packages/cli": {},
    "packages/web": {}
  }
}
```

---

## Option D: Custom Pre-Release Format

To use custom pre-release identifiers (not just alpha/beta/rc).

```json
{
  "release-type": "simple",
  "prerelease": true,
  "prerelease-type": "canary",
  "packages": {
    ".": {
      "extra-files": [
        { "type": "json", "path": "package.json", "jsonpath": "$.version" }
      ]
    }
  }
}
```

**Result:** v7.1.11 → v7.1.11-canary.1

---

## Extra-Files Behavior with Pre-Releases

All `extra-files` update correctly for pre-release versions.

### JSON Type (jsonpath)

```json
{
  "version": "7.1.11"
}
```

After pre-release bump:
```json
{
  "version": "8.0.0-beta.1"
}
```

### Generic Type (text marker)

**pyproject.toml:**
```toml
version = "7.1.11"  # x-release-please-version
```

After pre-release bump:
```toml
version = "8.0.0-beta.1"  # x-release-please-version
```

**CLAUDE.md:**
```markdown
**Current**: 7.1.11 · **Claude Code**: >= 2.1.69 <!-- x-release-please-version -->
```

After pre-release bump:
```markdown
**Current**: 8.0.0-beta.1 · **Claude Code**: >= 2.1.69 <!-- x-release-please-version -->
```

---

## Manifest File Format

File: `.release-please-manifest.json`

```json
{
  ".": "7.1.11"
}
```

Release-Please updates this automatically. Do NOT edit manually.

After release:
```json
{
  ".": "7.1.12"
}
```

Or for pre-release:
```json
{
  ".": "8.0.0-beta.1"
}
```

---

## Conventional Commits → Version Bumps

Release-Please analyzes commit messages to determine version bumps:

| Commit Type | Version Bump | Example |
|-------------|-------------|---------|
| `feat:` | MINOR | 7.1.11 → 7.2.0 |
| `fix:` | PATCH | 7.1.11 → 7.1.12 |
| `feat!:` or `BREAKING CHANGE:` | MAJOR | 7.1.11 → 8.0.0 |
| `chore:`, `docs:`, `refactor:`, `perf:` | (no bump) | Release PR only |

---

## Testing Your Config

Dry-run without creating a release:

```bash
# List what WOULD be released
gh api repos/:owner/:repo/releases --jq '.[] | .tag_name' | head -1

# Or check the Release PR that release-please creates
gh pr list --search "chore(main): release"
```

---

## Troubleshooting

### Issue: Version not updating in extra-files

**Solution:** Verify marker format matches:
- JSON: Ensure `jsonpath` is correct (e.g., `$.version`)
- Generic: Ensure marker comment is present and on correct line

### Issue: Pre-release versions not bumping correctly

**Solution:** Check `prerelease-type` in config:
- Should be `alpha`, `beta`, or `rc`
- Custom names (like `canary`) work but must be consistent

### Issue: Multiple pre-release channels conflicting

**Solution:** Use `separate-pull-requests: true` to create one PR per branch.

---

## References

- **Config Schema:** https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json
- **Release-Please Docs:** https://github.com/googleapis/release-please
- **Conventional Commits:** https://www.conventionalcommits.org/
- **Semantic Versioning:** https://semver.org/

---

**Last updated:** 2026-03-07
**Used by:** OrchestKit release-engineer
**Status:** Reference material
