# Claude Code adapter: implement

Slash invoke: `/ork:implement`

YAML `hooks:` / `command:` lines in this skill's frontmatter stay Claude-only.
They use `${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs` and are ignored by pi.

Session chain files live at `.claude/chain/` (state.json, decisions.json, capabilities.json).
Other hosts should persist equivalent run state in their own session store.

Agent spawn form, when used: `Agent(ork:...)` is Claude Code. Portable body text uses the skill name.

Lines that still mention a Claude-only path in the body:

```
Host-neutral workflow. Invoke by skill name (`implement`). Claude Code slash routing, YAML hook loaders, and `.claude/chain` live in `references/claude-code.md`.
Write(".claude/chain/capabilities.json", JSON.stringify({
Read(".claude/chain/state.json")
Write(".claude/chain/state.json", JSON.stringify({
Write(".claude/chain/state.json", JSON.stringify(state))
If `.claude/chain/assess-verdict.json` exists with a `feature` matching this run and `verdict == "fail"` (composite < the 5.5 `min_pass` in `../assess/rubric.json`, or any dimension below its `min_blocker`), **BLOCK Phase 1**. Present each `blockers[]` entry (dimension, score, reason), then `AskUserQuestion` with plain label+description options (no `preview`):
Before Phase 1, resolve the unknowns whose answers would **change the architecture**, in blast-radius order — schema/migration → auth → API contract → perf/scale → cosmetics (last). Grep first, then `AskUserQuestion` one at a time (highest first, cap ~5, skip the obvious). Each answer becomes a row in a Decisions table written to `.claude/chain/decisions.json` and the PR body, feeding Phase 4 (Architecture) as constraints. Do NOT start Phase 1 with an unresolved schema/auth question; skip in `low` effort. Full protocol: `Read("references/blast-radius-clarification.md")`.
> **Session recovery (CC 2.1.108+):** After idle periods or interruptions, use `/recap` to restore conversational context. Combined with `.claude/chain/state.json` checkpoint-resume, this enables full recovery of multi-phase implement sessions. Enabled by default since CC 2.1.110 (even with telemetry disabled).
```

## Session recovery

After idle periods or interruptions, use `/recap` to restore conversational context. Combined with `.claude/chain/state.json` checkpoint-resume, this enables full recovery of multi-phase implement sessions. Enabled by default since CC 2.1.110 (even with telemetry disabled).
