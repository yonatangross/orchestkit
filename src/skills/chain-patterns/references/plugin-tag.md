# `claude plugin tag` — Plugin Release Tagging

CC 2.1.118 added the `claude plugin tag` CLI command for tagging plugin releases with version validation. OrchestKit's release flow adopts this in M122 to catch manifest-vs-tag drift before users see it.

**Closes:** part of #1505 (M122-7). Reference for the release flow.

## What It Does

`claude plugin tag <version>` runs validation across the plugin manifest hierarchy:

| Check | Source of truth | Failure mode |
|---|---|---|
| Marketplace version matches | `.claude-plugin/marketplace.json` `version` | Tag rejected |
| Plugin `.claude-plugin/plugin.json` matches | per-plugin manifest | Tag rejected |
| `package.json` version matches | repo root | Tag rejected |
| `version.txt` matches (if present) | repo root | Tag rejected |
| No uncommitted changes in plugins/ | working tree | Tag rejected |
| Plugin can be loaded | `claude plugin validate` (CC ≥ 2.1.77) | Tag rejected |

If all pass, an annotated git tag `v<version>` is created locally; pushing it triggers downstream release automation (GitHub Release, NotebookLM sync, etc.).

## OrchestKit Adoption

### release-please integration

`.github/workflows/release-please.yml` runs `claude plugin tag` after release-please opens its release PR — it validates the staged version bump *before* the PR is approved, catching drift early.

```yaml
- name: Validate plugin tag
  if: ${{ steps.release.outputs.release_created == 'true' }}
  run: |
    claude plugin tag "${{ steps.release.outputs.version }}" --dry-run
```

`--dry-run` runs the validation without creating the tag (the actual tag is created by release-please's own GitHub Release step).

### Skill references

| Skill | Section to update |
|---|---|
| `src/skills/release-management/SKILL.md` | Add `claude plugin tag` to the validation checklist |
| `src/skills/release-checklist/SKILL.md` | Pre-release verification step |
| `src/skills/release-sync/SKILL.md` | Detect tag-based sync triggers |

## What Drift Looks Like

Real-world example caught by `claude plugin tag` in OrchestKit's history:

```
$ claude plugin tag 7.70.0
✗ Marketplace version mismatch
  expected: 7.70.0
  found:    7.69.0  (in .claude-plugin/marketplace.json)
  fix:      release-please extra-files entry missing $.plugins[0].version

✗ Plugin manifest version mismatch
  expected: 7.70.0
  found:    7.69.0  (in plugins/ork/.claude-plugin/plugin.json)
  fix:      stale plugins/ — run `npm run build` and re-stage
```

Without this check, users would have installed `ork@7.70.0` from the marketplace and gotten a 7.69.0 manifest — confusing and hard to diagnose.

## Failure Modes Pre-2.1.118

OrchestKit's release flow before adoption:

```
release-please bumps 5 files → CI builds plugins/ →
  drift in any of the 5 = user sees mismatched version → file bug → ship 7.69.1
```

Three OrchestKit releases (v7.65.1, v7.66.0, v7.67.0) had to be patch-released because of manifest drift. Adopting `claude plugin tag` in CI eliminates this class of bug at the source.

## Local Workflow

When making manual changes to plugin manifests:

```bash
# Bump versions across all 5 sites manually (or via release-please)
$EDITOR package.json manifests/ork.json .claude-plugin/marketplace.json \
        plugins/ork/.claude-plugin/plugin.json version.txt

# Validate before committing
claude plugin tag $(cat version.txt) --dry-run

# If green: commit and push (CI runs the same check non-dry)
git add . && git commit -m "chore: release X.Y.Z"
```

## Related

- `.github/workflows/release-please.yml` — release automation
- `.release-please-config.json` — extra-files configuration (5 file paths kept in sync)
- `src/skills/release-management/SKILL.md` — release flow ownership
- `src/skills/release-checklist/SKILL.md` — pre-release validation
