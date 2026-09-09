# Claude Code adapter: verify

Slash invoke: `/ork:verify`

YAML `hooks:` / `command:` lines in this skill's frontmatter stay Claude-only.
They use `${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs` and are ignored by pi.

Session chain files live at `.claude/chain/` (state.json, decisions.json, capabilities.json).
Other hosts should persist equivalent run state in their own session store.

Agent spawn form, when used: `Agent(ork:...)` is Claude Code. Portable body text uses the skill name.

Lines that still mention a Claude-only path in the body:

```
Host-neutral workflow. Invoke by skill name (`verify`). Claude Code slash routing, YAML hook loaders, and `.claude/chain` live in `references/claude-code.md`.
Write(".claude/chain/capabilities.json", { memory, timestamp })
Read(".claude/chain/state.json")  # resume if exists
Write(".claude/chain/verify-results.json", JSON.stringify({
Bash(command=f"bash ${{CLAUDE_PLUGIN_ROOT}}/skills/verify/scripts/assert-evidence.sh {LOG} --task-id '{task.id or 'none'}'")
A single green is not proof — flaky and order-dependent suites pass once and fail the next run. With `--streak=N`, verify declares **READY FOR MERGE only after N consecutive passing runs**, resetting the count to 0 on any non-ready verdict. The count persists across independent runs in `.claude/chain/verify-streak.json`, keyed by scope.
```
