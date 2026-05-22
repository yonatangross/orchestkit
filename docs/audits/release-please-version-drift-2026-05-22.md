# Postmortem: release-please version drift → 9.0.0 mis-bump

**Date:** 2026-05-22
**Severity:** High (visible — wrong major version proposed on `main`)
**Status:** Resolved (PR #1947) + Prevented (CI guard + docs + memory)
**Affected:** Release pipeline, `chore(main): release 9.0.0` (PR #1946)

---

## What happened

After v8.0.0 shipped via PR #1922 (release-please's automated PR), the next release-please run proposed **9.0.0** (PR #1946) — a MAJOR bump — for what should have been a routine **8.1.0** minor.

The 9.0.0 changelog draft re-included features going back to PR #1006, suggesting release-please had lost its anchor and was scanning the full project history rather than commits-since-last-release.

---

## Root cause

PR #1920 (M168 Phase 2 — SQLite Layer 1) was squashed into `main` carrying an inner commit `chore: bump to v8.1.0 + populate CHANGELOG`. That commit hand-edited 9 files release-please owns exclusively:

| File | release-please role |
|------|---------------------|
| `.release-please-manifest.json` | source of truth for current version |
| `version.txt` | release-please's anchor file |
| `package.json` | extra-file (`$.version` jsonpath) |
| `pyproject.toml` | extra-file (generic) |
| `.claude-plugin/marketplace.json` | extra-file (2 jsonpath entries) |
| `manifests/ork.json` | extra-file (`$.version`) |
| `CLAUDE.md` | extra-file (`x-release-please-version` marker) |
| `plugins/ork/.claude-plugin/plugin.json` | extra-file (`$.version`) |
| `plugins/ork/hooks/bin/stop-uncommitted-check.mjs` | extra-file (generic) |

The governed list lives in `.release-please-config.json` under `extra-files`.

### Why that broke release-please

release-please's state machine works by:

1. Reading the current version from `.release-please-manifest.json`.
2. Finding the git tag matching that version.
3. Scanning commits **since that tag** to compute the next bump.

After PR #1920:
- Manifest said `8.1.0`.
- No `v8.1.0` tag existed (release-please hadn't created one — that's its job alone).
- release-please couldn't find an anchor → fell back to the `bootstrap-sha` baseline.
- Scanned **all** commits since bootstrap, re-encountered `feat!: hard-delete monitors.json (#1919)` (already shipped in v8.0.0).
- The `!` suffix triggered a MAJOR bump → proposed 9.0.0.

The compare URL on the draft (`compare/v8.1.0...v9.0.0`) confirmed the drift — that tag never existed.

---

## Timeline (UTC, 2026-05-22)

| Time | Event |
|------|-------|
| 09:30 | PR #1919 (`feat!: hard-delete monitors.json`) merged → triggers MAJOR bump |
| 10:52 | PR #1922 (release-please) merged → v8.0.0 tagged + released cleanly |
| 13:28 | PR #1920 (SQLite Layer 1) merged, squashed message includes the inner `chore: bump to v8.1.0` commit → 9 governed files diverge |
| 13:30 | release-please auto-run on push → falls back to bootstrap-sha → opens PR #1946 proposing 9.0.0 |
| ~15:30 | User notices: "how the fuck 1946 is 9.0.0" |
| 15:38 | PR #1947 (fix) merged: reverts all 9 governed files to 8.0.0, adds CI guard, CONTRIBUTING note |
| 15:39 | release-please re-runs on the merge push, re-anchors on v8.0.0, updates #1946 in place: title → `chore(main): release 8.1.0` |
| 15:52 | PR #1946 merged → v8.1.0 released correctly |

---

## What we fixed

### Immediate (PR #1947)

- Reverted all 9 governed files back to `8.0.0` (matching `v8.0.0` tag).
- Stripped hand-written `[8.1.0]` and `[7.96.0]` sections from `CHANGELOG.md` so release-please regenerates cleanly.
- Rebuilt `plugins/` so generated artifacts (`plugin.json`, `stop-uncommitted-check.mjs`, `plugins-data.ts`, `changelog-data.ts`) carry the corrected version.

### Prevention (3 layers, also in #1947)

1. **CI gate** — `.github/workflows/release-please-guard.yml`. Diffs every non-bot PR against base, extracts the governed file list from `.release-please-config.json` at runtime, fails the PR if any governed file is touched. Bots (`orchestkit-release-bot[bot]`, `release-please[bot]`, `github-actions[bot]`) and branches matching `^(release-please|chore/cc-snapshot-)` bypass automatically. PRs labeled `release-please-override` also bypass (for legitimate exceptions like drift fixes themselves).
2. **CONTRIBUTING.md** — new "Do not hand-edit release-please's governed files" subsection under Versioning, with explicit pointer to this incident.
3. **Diagnosis playground** — `docs/fix--release-please-version-drift/release-please-drift.html` walks through the before/after, root cause, and fix for future incident reference.

### Side-fix (PR #1948)

The guard from #1947 surfaced a latent incompatibility: `version-check.yml` and `bin/git-hooks/pre-push` both used a skip-list regex that didn't include `issue/` or `bug/` branch prefixes, even though `CONTRIBUTING.md` documents both as valid. That created a catch-22 (bump and the guard fails; don't bump and version-check fails) for `issue/` PRs. PR #1948 added `issue` and `bug` to both regexes.

---

## Why the existing rule didn't catch it

`CONTRIBUTING.md` already had a "do not manually run `./bin/bump-version.sh`" rule (line 367). But the incident commit didn't run that script — it hand-edited the same files directly inside a squashed-PR's inner commit. The rule wording covered the script, not the files. The structural fix (CI guard) closes that gap regardless of *how* the files were edited.

---

## Lessons

| Lesson | Action |
|--------|--------|
| Squashed PR bodies hide intent — an inner `chore: bump to vX.Y.Z` commit can land without standalone review | CI guard now blocks based on file diffs, not commit messages |
| `release-please-config.json` is the source-of-truth for "what release-please owns" — anything in `extra-files` is off-limits to humans | Guard workflow reads this file at runtime, so the list stays in sync automatically |
| release-please's failure mode is **silent** — wrong version, no error | Treat any release-please draft proposing a major bump on a non-breaking commit as a red flag |
| The override label `release-please-override` exists for emergencies only — drift fixes, schema changes to a governed file | Use sparingly; document the reason in PR body |

---

## Audit trail

- 🚨 Visible symptom: PR [#1946](https://github.com/yonatangross/orchestkit/pull/1946) (mis-titled `release 9.0.0`, later auto-updated to 8.1.0)
- 🔥 Root-cause PR: [#1920](https://github.com/yonatangross/orchestkit/pull/1920) (the inner `chore: bump to v8.1.0` commit)
- ✅ Fix PR: [#1947](https://github.com/yonatangross/orchestkit/pull/1947) (revert + 3-layer prevention)
- ⚙️ Side-fix PR: [#1948](https://github.com/yonatangross/orchestkit/pull/1948) (extend skip-list regex)
- 🎯 Release that shipped: [v8.1.0](https://github.com/yonatangross/orchestkit/releases/tag/v8.1.0)
