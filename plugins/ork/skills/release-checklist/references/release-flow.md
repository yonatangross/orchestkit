# Release Flow Overview

## What Constitutes a Release

A release is a version-tagged commit pushed to the remote `main` branch. It triggers:
- Automated changelog parsing (reads `CHANGELOG.md`)
- GitHub Release creation (if CI is configured)
- Plugin distribution (consumers pull the tagged version)

Every release must be reproducible: another developer should be able to check out the tag and get a working, tested plugin set.

## Why the Checklist Order Matters

```
Build → Test → Security → Typecheck → Validate Counts → Changelog/Version → Diff → Stage → Commit → Tag → Push
```

Each step depends on the previous:
- Tests are meaningless if run against a stale build
- Count validation reads `plugins/` — must build first
- Diff review happens after version bumps so the bump is included in what you stage
- Tag is created after commit so it points to the right SHA
- Push is last and irreversible — everything else must be confirmed first

## Three-Plugin Consistency

OrchestKit ships three plugins from one source:

| Plugin | Skills | Agents | Description |
|--------|--------|--------|-------------|
| `orkl` | 46 | 36 | Universal toolkit |
| `ork-creative` | 2 | 1 | Video production add-on |
| `ork` | 63 | 36 | Full stack |

All three must have consistent counts in their manifests. The `/validate-counts` step catches drift between `src/` and `manifests/`.

## Hotfix vs. Normal Release

For a hotfix (urgent patch from `main`):
1. Branch from the release tag: `git checkout -b hotfix/vX.Y.Z vX.Y.Z`
2. Apply the fix, run the full checklist
3. Bump patch version only
4. Merge back to `main` and `dev`

The checklist steps are identical — never skip them for hotfixes.

## Common Release Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Count mismatch | Added skill/hook but didn't update manifest | Edit manifest, re-build |
| `plugins/` empty | Build interrupted or not run | `npm run build` |
| Security test fails | New hook introduced vulnerable pattern | Fix hook, do not bypass |
| Version mismatch | Bumped `package.json` but forgot `CLAUDE.md` | Update `CLAUDE.md` |
| Tag already exists | Ran `git tag` twice | `git tag -d vX.Y.Z` then re-tag |
