# Release-Please Pre-Release Support

## Status: RESEARCH COMPLETE

Release-Please **fully supports pre-release versions** (alpha, beta, RC).

## Quick Answers to Your Questions

### 1. Does release-please support pre-release channels?

**YES.** Release-Please supports:
- `8.0.0-alpha.1` (early, unstable)
- `8.0.0-beta.1` (feature-complete, stability testing)
- `8.0.0-rc.1` (release candidate, production-ready)

### 2. Multi-branch support?

**YES.** Release-Please works with multiple branches:
- `main` → stable (v7.1.11)
- `next` → pre-release track (v8.0.0-alpha.1)
- `beta` → feature-complete pre-release (v8.0.0-beta.1)
- `alpha` → early access (v8.0.0-alpha.1)

**OrchestKit already has:** Manual `prerelease.yml` for alpha/beta branches + `release-please.yml` for main.

### 3. `prerelease` and `prerelease-type` config options?

**Config options in `.release-please-config.json`:**

```json
{
  "prerelease": true,
  "prerelease-type": "alpha|beta|rc",
  "separate-pull-requests": true
}
```

**Or branch-based:**

```json
{
  "branches": [
    {
      "branch": "main",
      "channel": "latest"
    },
    {
      "branch": "next",
      "channel": "beta",
      "prerelease-type": "beta"
    }
  ]
}
```

### 4. Extra-files with pre-release versions?

**YES.** `x-release-please-version` marker handles pre-release correctly:

```json
// Before
{ "version": "7.1.11" }

// After pre-release bump to 8.0.0-beta.1
{ "version": "8.0.0-beta.1" }
```

All 7 files in `extra-files` (package.json, pyproject.toml, CLAUDE.md, etc.) update correctly.

### 5. Limitations?

| Limitation | Workaround |
|-----------|-----------|
| No auto-promotion (beta→rc→stable) | Use branch strategy for staging |
| Single prerelease track per config | Use separate branches (OrchestKit does this) |
| CHANGELOG formatting varies | Customize via config |

## OrchestKit's Current Setup

### Existing Implementation (Proven)
- **prerelease.yml**: Manual pre-release workflow
  - Triggers on `beta`/`alpha` branch pushes
  - Creates tags: `v7.1.11-beta.123` (with run number)
  - All tests run before release

- **release-please.yml**: Automatic stable releases
  - Triggers on `main` pushes
  - Semantic versioning: v7.1.11
  - Automatic changelog from commits

### Why This Works
- No version conflicts between stable and pre-release tracks
- Pre-release versions follow semver format
- Extra-files sync correctly across both workflows
- Tests enforce quality on both stable and pre-release

## When to Use Each Config

### Option 1: Keep Current (RECOMMENDED)
```json
{
  "release-type": "simple",
  "include-component-in-tag": false
}
```
- ✅ Simple, proven, no changes needed
- ✅ Manual control over pre-release timing
- ⚠️ Pre-release changelogs not auto-generated

### Option 2: Integrate release-please for pre-releases
```json
{
  "release-type": "simple",
  "branches": [
    {
      "branch": "main",
      "channel": "latest"
    },
    {
      "branch": "next",
      "channel": "beta",
      "prerelease-type": "beta"
    }
  ]
}
```
- ✅ Single source of truth for versioning
- ✅ Automatic pre-release changelogs
- ⚠️ Requires branch strategy coordination

### Option 3: Hybrid
- Keep `prerelease.yml` for hotfixes
- Use release-please `next` for planned pre-releases
- Most flexible, most complex

## Technical Details

### Version Replacement in Extra-Files

Release-Please's extra-files update ANY `x-release-please-version` marker:

```txt
Marker comment: # x-release-please-version
Marker comment: // x-release-please-version
Marker comment: <!-- x-release-please-version -->
```

Supported transformations:
- Stable: `7.1.11` → `7.1.12`
- Pre-release: `7.1.11` → `8.0.0-beta.1`
- RC: `7.1.11` → `8.0.0-rc.1`

### Configuration Schema

Full schema at: https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json

Key section:

```json
{
  "prerelease": boolean,           // Mark as pre-release
  "prerelease-type": "alpha|beta|rc",  // Pre-release identifier
  "separate-pull-requests": boolean,   // One PR per branch
  "branches": [                    // Multi-branch setup
    {
      "branch": "string",
      "channel": "string",
      "prerelease-type": "string"
    }
  ]
}
```

## Decision: Stick with Current Setup

**Recommendation:** Keep OrchestKit's current setup (manual prerelease.yml + release-please for main).

**Rationale:**
1. Already working and tested
2. Provides manual control over pre-release timing
3. No breaking changes required
4. Can add branch-based release-please later if needed

## For Future Reference

If OrchestKit moves to release-please for pre-releases:
1. Create `next` branch
2. Add branch config to `.release-please-config.json`
3. Update GitHub Actions to handle both `main` and `next` triggers
4. No changes needed to extra-files — they handle pre-release versions automatically

---

**Last updated:** 2026-03-07
**Session:** release-engineer research
**Status:** Ready for implementation (if needed)
