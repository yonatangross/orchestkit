---
paths:
  - "src/agents/**"
---

# Agent Authoring Rules

## Required Frontmatter
- `name` (kebab-case, must match filename)
- `description` (third person, concise — Claude uses this for agent selection)
- `model`: fable | opus | sonnet | haiku | inherit (vocabulary: src/hooks/src/lib/models.vocab.json — premium tiers fable/opus are reserved for high-complexity agents, enforced by test-agent-model-tool-correlation.sh)
- `tools`: array of tool names — e.g. Read, Write, Edit, Bash, Grep, Glob, Agent(sub-name)
- `skills`: array of skill names the agent can access

## Optional Flags
- `background: true` — agent never needs interactive results (fire-and-forget)
- `isolation: worktree` — run in isolated git worktree (safe for heavy writes)
- `context: fork` — isolated subagent context
- `maxTurns: N` — conversation turn limit
- `critical_system_reminder: "..."` — persistent guardrail injected at spawn via context-stager
- `required_mcp_servers: [name1, name2]` — warns if MCP servers unavailable at spawn
- `disallowedTools: [...]` — deny-list. CC 2.1.178 **fixed** MCP server-level specs (`mcp__server`, `mcp__server__*`, `mcp__*`) being silently ignored in subagents; they now enforce at spawn. Use `disallowedTools: [mcp__*]` to scope MCP access for a background/untrusted subagent.

## Agent-scoped `hooks:` (CC ≥ 2.1.116)
Hooks declared in agent frontmatter fire in both contexts: spawned-as-subagent (Task tool) AND main-thread (`claude --agent <name>`). Write hooks context-agnostic — validate `tool_input`, apply policy, log with `CLAUDE_AGENT_ID` (defaults to `'unknown'`). Do not branch on "am I a subagent?".

## Decision Guide
- Heavy writes (build, refactor)? → `isolation: worktree`
- Fire-and-forget (research, eval)? → `background: true`
- Needs user interaction? → neither flag
- Spawns subagents? → add `Agent(sub-name)` to tools

## After Changes
- Update `manifests/ork.json` + CLAUDE.md agent count
- Run: `npm run build && npm run test:agents`
