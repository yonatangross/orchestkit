# Hooks Invoking MCP Tools — `type: "mcp_tool"`

CC 2.1.118 added a new hook dispatch type that lets a registered hook invoke an MCP tool directly, without spawning a subagent. Unlocks fast access to MCP context (memory, agentation, sequential-thinking) from inside hook handlers.

**Closes:** part of #1501 (M122-4). Reference for adoption.

## Why This Replaces Old Patterns

Before 2.1.118, a hook that needed MCP context had two options, both bad:

| Old approach | Cost | Failure mode |
|---|---|---|
| Spawn a subagent via `Agent()` from inside the hook | 30–60s + ~150K tokens | Hook timeouts, context budget blown |
| Shell out to `npx -y <mcp-server>` and parse stdout | 2–5s + brittle parser | npm cache misses, MCP version drift, ad-hoc auth |

Both forced hooks into either expensive (subagent) or fragile (shell) territory for what should be a simple tool call.

## The New Type

In `hooks.json`, register a hook that invokes an MCP tool:

```json
{
  "PreToolUse": [
    {
      "matcher": "Write",
      "type": "mcp_tool",
      "tool": "mcp__memory__search_nodes",
      "input": {
        "query": "${input.tool_input.file_path}"
      },
      "outputMapping": "additionalContext"
    }
  ]
}
```

`type: "mcp_tool"` tells CC to:
1. Resolve the MCP server (must be enabled in `.mcp.json`)
2. Dispatch the tool call with `input` (templated against the hook's input)
3. Return the MCP response back to the hook context (via `outputMapping`)

No subprocess spawn, no shell parsing — same dispatch path the model uses when invoking the tool itself.

## Pattern 1 — Inject Memory Context Before Edit

```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit",
      "type": "mcp_tool",
      "tool": "mcp__memory__search_nodes",
      "input": { "query": "${input.tool_input.file_path}" },
      "outputMapping": "additionalContext"
    }
  ]
}
```

Use case: surface prior decisions about the file being edited.

## Pattern 2 — Read Annotation Queue After Read

```json
{
  "PostToolUse": [
    {
      "matcher": "Read",
      "type": "mcp_tool",
      "tool": "mcp__agentation__agentation_get_pending",
      "input": { "filePath": "${input.tool_input.file_path}" },
      "outputMapping": "systemMessage"
    }
  ]
}
```

Use case: alert the model when annotations exist for the file just read.

## Pattern 3 — Sequential Thinking on Long Tasks

```json
{
  "TaskCreated": [
    {
      "matcher": ".*",
      "type": "mcp_tool",
      "tool": "mcp__sequential-thinking__sequentialthinking",
      "input": { "thought": "Decompose: ${input.task_description}", "thoughtNumber": 1, "totalThoughts": 5, "nextThoughtNeeded": true },
      "outputMapping": "additionalContext",
      "condition": "task_description.length > 200"
    }
  ]
}
```

Use case: kick off a structured plan for any task description over 200 chars.

## When NOT to Use

| Situation | Use instead |
|---|---|
| MCP server is `disabled: true` in `.mcp.json` | Skip the hook (it'll fail at dispatch) |
| You need to gate on the MCP response | Subagent — `mcp_tool` doesn't support conditional logic in-place |
| The hook needs MCP output for >1 downstream MCP call | Subagent — chained MCP calls are expensive in this dispatch type |
| MCP server is HIGH-tier (`@21st-dev/magic`, `agentation` pre-1.0) | Pin first (see `src/skills/mcp-patterns/references/mcp-version-matrix.md`) |

## Performance Envelope

| Path | Cold | Warm | Cost (tokens) |
|---|---|---|---|
| Subagent spawn | 30–60s | 30–60s | ~150K |
| Shell `npx -y` | 2–5s | 0.3–1s | ~0 |
| `type: "mcp_tool"` | 0.1–0.3s | 0.05–0.1s | ~0 (within MCP server limits) |

The new type is functionally a free dispatch — same overhead as the model invoking the tool itself.

## Tier Compatibility

The new type is enforced at hook registration time (CC ≥ 2.1.118). For older CC versions, hook registration is rejected with `unsupported hook type: "mcp_tool"`. OrchestKit floors at 2.1.118 as of 7.70.0 — see `src/hooks/src/lib/cc-version-matrix.ts`.

## Related

- `chain-patterns/references/monitor-patterns.md` — Monitor tool for streaming process output
- `src/skills/mcp-patterns/references/mcp-version-matrix.md` — Tier classification for `.mcp.json` entries
- `src/skills/doctor/references/mcp-pinning-check.md` — Doctor warn on HIGH-tier `@latest`
