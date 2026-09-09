# Claude Code adapter: brainstorm

Slash invoke: `/ork:brainstorm`

YAML `hooks:` / `command:` lines in this skill's frontmatter stay Claude-only.
They use `${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs` and are ignored by pi.

Session chain files live at `.claude/chain/` (state.json, decisions.json, capabilities.json).
Other hosts should persist equivalent run state in their own session store.

Agent spawn form, when used: `Agent(ork:...)` is Claude Code. Portable body text uses the skill name.

Lines that still mention a Claude-only path in the body:

```
Host-neutral workflow. Invoke by skill name (`brainstorm`). Claude Code slash routing, YAML hook loaders, and `.claude/chain` live in `references/claude-code.md`.
> **PostCompact recovery:** Long brainstorm sessions may trigger context compaction. The PostCompact hook re-injects branch and task state. If compaction occurs mid-brainstorm, check `.claude/chain/state.json` for the last completed phase and resume from the next handoff file (see Phase Handoffs table). Reactive compaction (CC 2.1.142+) now sizes the first summarize to the actual overflow, so mid-turn stalls are rare — no need to expect a second pass.
```
