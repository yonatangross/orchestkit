# Design: skill-mirror single-source (#2528, structural)

Status: **design decision needed** · Verified at HEAD `0f7200dac` (2026-07-10)

The acute friction (#2528-A — CI blocking single-file/web skill edits) is fixed
separately by hardening `skill-autobuild.yml` to re-trigger CI with an App token.
This doc covers the **structural** duplication that #2528-A does not remove.

## Confirmed state

| Tree | Count | Role |
|---|---|---|
| `src/skills/*/SKILL.md` | 114 | authoring source |
| `plugins/ork/skills/*/SKILL.md` | 114 | committed byte-mirror (build output) |
| `plugins/ork/commands/*.md` | 33 | committed command wrappers (build output) |
| tracked files under `plugins/ork/{skills,commands}` | ~1969 | generated, committed |

`diff -rq src/skills plugins/ork/skills` → one intentional diff (`assess/evals`
stripped by build, #2555); everything else byte-identical. Skills are committed
**2x** (all 114) and **3x** for the 33 user-invocable ones.

## The binding constraint

`.claude-plugin/marketplace.json:25` → `source: "./plugins/ork"`. **CC copies the
committed files on install — it never runs a build.** 80+ of 114 skills have no
command wrapper, so they are discoverable *only* via `plugins/ork/skills/`. Any
change that removes the committed mirror **breaks every git / marketplace install**.

## Options

| Option | Removes dup? | Git-install safe? | Cost |
|---|---|---|---|
| **A. Keep mirror + autobuild heal** (#2528-A shipped) | No | ✅ safe | low — friction only |
| **B. Single-source via built artifact/branch** | ✅ yes | ✅ only if `marketplace.json source:` moves off the source branch | high — distribution-contract change + 8 conformance tests |
| **C. Symlink `plugins/ork/skills` → `src/skills`** | ✅ yes | ❌ unsound | build rejects symlinks; CC copy-install + Windows clones don't follow repo symlinks |
| **Drop `commands/` wrappers** | partial | — | ❌ blocked upstream on anthropics/claude-code#18949 (native namespaced skill discovery); wrappers are the sole namespace + collision shield (~2.8k tok/session) |

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
triplication.** The token-tax lever (dropping wrappers) stays blocked on
claude-code#18949.

## Decision required

Team call: accept the committed triplication as the cost of build-free installs
(status quo + #2528-A), or invest in Option B's publish-model change. This doc is
the input to that decision; no code change is proposed here.
