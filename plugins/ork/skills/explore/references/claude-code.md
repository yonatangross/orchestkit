# Claude Code adapter: explore

Slash invoke: `/ork:explore`

YAML `hooks:` / `command:` lines in this skill's frontmatter stay Claude-only.
They use `${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs` and are ignored by pi.

Session chain files live at `.claude/chain/` (state.json, decisions.json, capabilities.json).
Other hosts should persist equivalent run state in their own session store.

Agent spawn form, when used: `Agent(ork:...)` is Claude Code. Portable body text uses the skill name.

Lines that still mention a Claude-only path in the body:

```
Host-neutral workflow. Invoke by skill name (`explore`). Claude Code slash routing, YAML hook loaders, and `.claude/chain` live in `references/claude-code.md`.
Write(".claude/chain/capabilities.json", { memory, timestamp })
Write(".claude/chain/exploration.json", JSON.stringify({
| `json-render` | Emit `.claude/chain/explore-dashboard.json` only. Skip markdown report. |
3. Write to `.claude/chain/explore-dashboard.json` with compact JSON (no indentation) — minimizes token cost for downstream consumers.
node "${CLAUDE_SKILL_DIR}/scripts/render-spec.mjs" .claude/chain/explore-dashboard.json --check
node "${CLAUDE_SKILL_DIR}/scripts/render-spec.mjs" .claude/chain/explore-dashboard.json
**Why this matters:** Downstream skills (`fix-issue`, `implement`, `create-pr`) parse `.claude/chain/explore-dashboard.json` directly instead of re-reading 3000-token markdown. Measured: spec ≈ 580 tokens for the same content. Backwards-compatible: old chained workflows that read markdown keep working in `both` mode.
```
