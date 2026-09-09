# Claude Code adapter: assess

Slash invoke: `/ork:assess`

YAML `hooks:` / `command:` lines in this skill's frontmatter stay Claude-only.
They use `${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs` and are ignored by pi.

Session chain files live at `.claude/chain/` (state.json, decisions.json, capabilities.json).
Other hosts should persist equivalent run state in their own session store.

Agent spawn form, when used: `Agent(ork:...)` is Claude Code. Portable body text uses the skill name.

Lines that still mention a Claude-only path in the body:

```
Host-neutral workflow. Invoke by skill name (`assess`). Claude Code slash routing, YAML hook loaders, and `.claude/chain` live in `references/claude-code.md`.
Write(".claude/chain/capabilities.json", {
state = Read(".claude/chain/state.json")  # may not exist
    last_handoff = Read(f".claude/chain/{state.last_handoff}")
| `json-render` | Emit `.claude/chain/assess-dashboard.json` only. Skip markdown report. |
4. Write to `.claude/chain/assess-dashboard.json` with compact JSON.
node "${CLAUDE_SKILL_DIR}/scripts/render-spec.mjs" .claude/chain/assess-dashboard.json --check
node "${CLAUDE_SKILL_DIR}/scripts/render-spec.mjs" .claude/chain/assess-dashboard.json
**Downstream consumption:** `implement` reads `.claude/chain/assess-dashboard.json` and pulls the lowest-scoring dimension and high-priority improvements (effort ≤ 2 AND impact ≥ 4) without parsing markdown tables. Measured: assess spec ≈ 830 tokens vs ~3500 token markdown for the same content.
`<assessment-dir>` is the dir containing `assessment.json` (typically the session's `.claude/chain/`). The script writes a `memory-writeback.json` handoff alongside it.
// .claude/chain/assess-verdict.json
- `.claude/chain/assess-verdict.json` written with verdict pass/fail and a blockers[] entry for every dimension below its min_blocker
```
