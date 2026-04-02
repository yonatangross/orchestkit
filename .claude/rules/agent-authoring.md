---
paths:
  - "src/agents/**"
---

# Agent Authoring Rules

## Required Frontmatter
- `name` (kebab-case, must match filename)
- `description` (third person, concise — Claude uses this for agent selection)
- `model`: opus | sonnet | haiku
- `tools`: array of tool names — e.g. Read, Write, Edit, Bash, Grep, Glob, Agent(sub-name)
- `skills`: array of skill names the agent can access

## Optional Flags
- `background: true` — agent never needs interactive results (fire-and-forget)
- `isolation: worktree` — run in isolated git worktree (safe for heavy writes)
- `context: fork` — isolated subagent context
- `maxTurns: N` — conversation turn limit
- `critical_system_reminder: "..."` — persistent guardrail injected at spawn via context-stager
- `required_mcp_servers: [name1, name2]` — warns if MCP servers unavailable at spawn

## Decision Guide
- Heavy writes (build, refactor)? → `isolation: worktree`
- Fire-and-forget (research, eval)? → `background: true`
- Needs user interaction? → neither flag
- Spawns subagents? → add `Agent(sub-name)` to tools

## After Changes
- Update `manifests/ork.json` + CLAUDE.md agent count
- Run: `npm run build && npm run test:agents`
