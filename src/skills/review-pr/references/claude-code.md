# Claude Code adapter: review-pr

Slash invoke: `/ork:review-pr`

YAML `hooks:` / `command:` lines in this skill's frontmatter stay Claude-only.
They use `${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs` and are ignored by pi.

Session chain files live at `.claude/chain/` (state.json, decisions.json, capabilities.json).
Other hosts should persist equivalent run state in their own session store.

Agent spawn form, when used: `Agent(ork:...)` is Claude Code. Portable body text uses the skill name.

Lines that still mention a Claude-only path in the body:

```
Host-neutral workflow. Invoke by skill name (`review-pr`). Claude Code slash routing, YAML hook loaders, and `.claude/chain` live in `references/claude-code.md`.
Write(".claude/chain/capabilities.json", { memory, timestamp })
```
