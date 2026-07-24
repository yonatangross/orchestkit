# Workflow Architect Memory

## Project Context
- OrchestKit: Claude Code plugin, 69 skills, 38 agents, 96 hooks
- Single unified plugin: `ork` (v7.0.0)
- Source in `src/skills/<name>/SKILL.md` — NEVER edit `plugins/`
- Build: `npm run build` after any `src/` change

## Key Skills (Related to Version Management)
- `doctor` — health diagnostics, 11 categories, user-invocable
- `configure` — interactive setup wizard, AskUserQuestion pattern
- `remember` / `memory` — knowledge graph read/write

## Decisions
- [Swarm decomposer verdict](project_swarm_decomposer_decision.md) — BUILD-MINIMAL but as a topology+specialist ROUTER emitting a Workflow/roster artifact, NOT a coordinator; coordination already solved
- [Execution-strategy selector](project_execution_strategy_selector.md) — #2516 per-card Execute tab: plan-only router, decision-table auto-recommend, emits copy-paste invocation, override-with-cost-warning

## Patterns Confirmed
- Skills use YAML frontmatter + Markdown body
- `user-invocable: true` + `allowed-tools` for Claude-driven commands
- `AskUserQuestion` tool used for multi-step wizards (see configure skill)
