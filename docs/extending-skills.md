# Extending ork skills (don't hand-edit the installed copy)

The skills ork ships are **files on your disk** after install — which makes them
tempting to tweak in place. Don't. This page is the supported way to customize,
and why the in-place edit bites you.

## Why not hand-edit the installed skill

When you edit a skill inside the installed plugin tree — e.g.
`~/.claude/plugins/cache/orchestkit/ork/skills/<name>/SKILL.md` (or a marketplace
checkout) — two things go wrong:

1. **It's overwritten on update.** `claude plugin update ork@orchestkit` (or a
   marketplace refresh) replaces the built tree. Your edit vanishes with no warning.
2. **It silently diverges from canonical.** Your `/ork:<name>` now answers from a
   playbook that no longer matches the published one. Real example: a maintainer's
   `~/.claude/skills/ci-debug/SKILL.md` drifted to **11 patterns** (with a different
   #11) while the published `ork:ci-debug` had **10** — two playbooks under
   near-identical names, and no way to tell which one answered.

The published skill is a build artifact (`src/skills/<name>/SKILL.md` →
`plugins/ork/skills/...` → `plugins/ork/commands/...`). Editing the leaf, not the
source, guarantees drift.

## Supported ways to customize

| You want to… | Do this |
|---|---|
| Add your own behavior on top of ork | Create a **user-level skill** in `~/.claude/skills/<name>/SKILL.md`. It's discovered alongside plugins and survives updates. |
| Customize for one repo only | Create a **project skill** in `.claude/skills/<name>/SKILL.md`, committed with the repo. |
| Change ork's actual behavior for everyone | **Open a PR** against `src/skills/<name>/SKILL.md` in this repo (never edit `plugins/` — it's generated; see `CLAUDE.md`). |
| Turn an ork skill off | `disableBundledSkills` / `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` (CC 2.1.169+), or scope it out in settings. |

User- and project-level skills take precedence and compose with the plugin's —
you extend, you don't fork.

## Check whether your installed copy has drifted

```bash
# Compare your installed skill against the canonical source in this repo
diff <(cat ~/.claude/plugins/cache/orchestkit/ork/skills/ci-debug/SKILL.md) \
     <(git -C /path/to/orchestkit show origin/main:plugins/ork/skills/ci-debug/SKILL.md)
```

A non-empty diff on a skill you didn't intend to fork means a stale or
hand-edited install. Re-sync with `claude plugin update ork@orchestkit`.

## Related

- `CLAUDE.md` — "Edit `src/`, NEVER edit `plugins/`" (the same rule, for contributors).
- Issue #2528 — why the skill build/mirror is structured this way, and the tracked
  upstream blocker (CC #18949) for removing the `commands/` duplication.
