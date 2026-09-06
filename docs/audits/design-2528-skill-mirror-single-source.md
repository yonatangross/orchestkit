# Design: skill-mirror single-source (#2528, structural)

Status: **decided 2026-09-06 by Yonatan: keep the committed mirror, Option B deferred** (see the Decision section) · Counts verified at HEAD `0f7200dac` (2026-07-10), two rows re-verified 2026-09-06 and marked below

The acute friction (#2528-A — CI blocking single-file/web skill edits) is fixed
separately by hardening `skill-autobuild.yml` to re-trigger CI with an App token.
This doc covers the **structural** duplication that #2528-A does not remove.

## Confirmed state

| Tree | Count | Role |
|---|---|---|
| `src/skills/*/SKILL.md` | 114 | authoring source |
| `plugins/ork/skills/*/SKILL.md` | 114 | committed byte-mirror (build output) |
| `plugins/ork/commands/*.md` | **0** (re-verified 2026-09-06; was 33) | retired by #3807 on 2026-08-30. Claude Code lists plugin skills namespaced on its own (measured 2026-09-06 on 2.1.263: `/probemd:base` expands and the model's list reads `probemd:base`), so the wrappers now exist only for the Cursor host, 35 files under `plugins/ork/.cursor-plugin/commands/`, where Claude Code's default `commands/` scan never looks |
| tracked files under `plugins/ork/skills` | 1583 (re-verified 2026-09-06) | generated, committed |

`diff -rq src/skills plugins/ork/skills` → one intentional diff (`assess/evals`
stripped by build, #2555); everything else byte-identical. Skills are committed
**2x** (all 106 at HEAD 2026-09-06). The 3x row is gone with #3807; the
duplication this doc is about is exactly the byte-mirror.

## The binding constraint

`.claude-plugin/marketplace.json` (re-verified 2026-09-06; the row used to read
`source: "./plugins/ork"`): both entries are now `source: git-subdir` with
`path: plugins/ork`, the `ork` channel pinned to `ref: v9.8.0` and `ork-alpha`
tracking `ref: main`. The constraint is unchanged by the source type: **CC
copies the committed files at that ref on install and never runs a build.** With
the Claude Code wrappers retired (#3807), every one of the 106 skills is
discoverable *only* via `plugins/ork/skills/`. Any change that removes the
committed mirror **breaks every git / marketplace install**.

## Options

| Option | Removes dup? | Git-install safe? | Cost |
|---|---|---|---|
| **A. Keep mirror + autobuild heal** (#2528-A shipped) | No | ✅ safe | low — friction only |
| **B. Single-source via built artifact/branch** | ✅ yes | ✅ only if `marketplace.json source:` moves off the source branch | high — distribution-contract change + 8 conformance tests |
| **C. Symlink `plugins/ork/skills` → `src/skills`** | ✅ yes | ❌ unsound | build rejects symlinks; CC copy-install + Windows clones don't follow repo symlinks |
| **Drop `commands/` wrappers** | partial | — | ✅ landed as #3807 (2026-08-30) for Claude Code, which now namespaces plugin skills itself; the Cursor host keeps its own set under `.cursor-plugin/commands/` (re-verified 2026-09-06) |

## Recommendation

**Option B is the only true single-source path, and it is a deliberate
distribution redesign — not a quick fix.** It requires:
1. Gitignore `plugins/ork/skills` (+ `commands`) in the working tree.
2. A publish step that builds `plugins/ork` into a release artifact **or** a
   dedicated built branch.
3. Repoint `marketplace.json source:` at that artifact/branch.
4. Update the ~8 conformance tests that read the committed tree.

Until then, the memory verdict holds: **gitignoring the mirror is unsound
(breaks git installs); autobuild heals the friction but does not fix the
triplication.** The token-tax lever (dropping the Claude Code wrappers)
landed as #3807 on 2026-08-30.

## Decision (2026-09-06, Yonatan)

**Keep the committed `plugins/` mirror (Option A). Option B, the built
artifact or built branch, is deferred.** The mirror is the install surface
every harness reads, the autobuild heals the contribution friction, and the
wrapper triplication is already gone (#3807). What landed instead, in the PR
that closes #2528:

1. Every harness manifest is stamped from `package.json` inside the build
   (`scripts/stamp-counts.sh` `sync_versions()`): the two Codex source
   manifests had no writer and sat at 9.5.4 across 40 releases
   (`docs/audits/codex-alignment-readonly-2026-09-06.md`). The two now also
   sit in release-please's extra-files, `tests/unit/test-sync-versions.sh`
   asserts all seven agree with `package.json`, and
   `tests/ci/fault-arms/sync-versions.sh` proves a hand-edited 9.5.4 fails.
2. One measurement, no sweep: CC 2.1.263 ignores `argument-hint`,
   `disable-model-invocation` and `user-invocable` under `metadata.*`
   (`docs/audits/skill-metadata-keys-probe-2026-09-06.md`), so a spec-clean
   frontmatter sweep cannot move those keys today.

**Reopen condition:** a second external-contributor drift-gate failure (the
first was #2527), or a harness that cannot install from committed files.
Either one makes Option B's cost worth paying; nothing short of that does.
