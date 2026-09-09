# Claude Code adapter: doctor

Slash invoke: `/ork:doctor`

YAML `hooks:` / `command:` lines in this skill's frontmatter stay Claude-only.
They use `${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs` and are ignored by pi.

Session chain files live at `.claude/chain/` (state.json, decisions.json, capabilities.json).
Other hosts should persist equivalent run state in their own session store.

Agent spawn form, when used: `Agent(ork:...)` is Claude Code. Portable body text uses the skill name.

Lines that still mention a Claude-only path in the body:

```
Host-neutral workflow. Invoke by skill name (`doctor`). Claude Code slash routing, YAML hook loaders, and `.claude/chain` live in `references/claude-code.md`.
1. Resolve the configured effort, in order: `.claude/settings.json` → `effort`, then `$ORCHESTKIT_EFFORT` (populated by the effort-detector hook), then any `.claude/chain/*.json` entry that explicitly set `effort: xhigh`. No `xhigh` anywhere means pass, no output.
```
