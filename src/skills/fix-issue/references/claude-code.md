# Claude Code adapter: fix-issue

Slash invoke: `/ork:fix-issue`

YAML `hooks:` / `command:` lines in this skill's frontmatter stay Claude-only.
They use `${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs` and are ignored by pi.

Session chain files live at `.claude/chain/` (state.json, decisions.json, capabilities.json).
Other hosts should persist equivalent run state in their own session store.

Agent spawn form, when used: `Agent(ork:...)` is Claude Code. Portable body text uses the skill name.

Lines that still mention a Claude-only path in the body:

```
Host-neutral workflow. Invoke by skill name (`fix-issue`). Claude Code slash routing, YAML hook loaders, and `.claude/chain` live in `references/claude-code.md`.
Write(".claude/chain/capabilities.json", JSON.stringify({
Read(".claude/chain/state.json")
Write(".claude/chain/state.json", JSON.stringify({
Write handoff JSON after phases 3, 4, 6, 7 to `.claude/chain/`. See `chain-patterns` skill for schema.
Once RCA confirms the cause and BEFORE Phase 5 (Fix Design), run two checks: (1) **root cause vs symptom** — is this the real fix, or a `# type: ignore` / retag / downgrade patch of a symptom? (2) the fix's **blast-radius** via ordered `AskUserQuestion` (schema/migration → auth → public contract/breaking → backfill/scale; skip cosmetic, cap ~4). Each answer becomes a row in `.claude/chain/decisions.json` and the PR body, feeding Phase 5 and the regression test. Skip for **Hotfix** / `low` effort. Full protocol: `Read("references/fix-blast-radius.md")`.
```
