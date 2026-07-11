# `designs/` — plan-visualization output

Save location for design and plan artifacts. This is a **runtime output
directory**, not hand-maintained content — most files here are ephemeral.

- **`ascii-design-system.md`** — the seed reference doc for the ASCII visual
  language used by `/ork:visualize-plan` and the `ascii-visualizer` skill.

## Why it looks near-empty

The `/ork:visualize-plan` skill saves full plan reports here as
`designs/<branch-name>.md` (see `src/skills/visualize-plan/SKILL.md`). Those are
generated per-branch on demand, so the committed contents stay minimal. The
directory is the skill's hardcoded save path — keep it.
