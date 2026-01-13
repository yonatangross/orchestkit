# MCP Configuration

MCPs (Model Context Protocol servers) enhance SkillForge commands but are **NOT required**.
Commands work without them - MCPs just add extra capabilities.

## Available MCPs

| MCP | Purpose | Enhances |
|-----|---------|----------|
| **context7** | Up-to-date library documentation | /implement, /verify, /review-pr |
| **sequential-thinking** | Structured reasoning for complex problems | /brainstorm, /implement |
| **memory** | Cross-session knowledge persistence | /brainstorm, /explore, /fix-issue |
| **playwright** | Browser automation for E2E testing | /verify, browser-content-capture skill |

## Default State

**All MCPs are disabled by default.** Enable only the ones you need.

## Enabling MCPs

Edit `.mcp.json` and set `"disabled": false` for selected MCPs:

```json
{
  "$schema": "https://raw.githubusercontent.com/anthropics/claude-code/main/schemas/mcp.schema.json",
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "description": "Up-to-date documentation for frameworks and libraries",
      "disabled": false
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-server-sequential-thinking"],
      "description": "Complex reasoning and architectural decision support",
      "disabled": true
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-server-memory"],
      "description": "Cross-session memory and context persistence",
      "env": {
        "MEMORY_FILE": ".claude/memory/memory.json"
      },
      "disabled": true
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-server-playwright"],
      "description": "Browser automation for e2e testing and content capture",
      "disabled": true
    }
  }
}
```

## Without MCPs

If user selects "None":
- Keep all MCPs disabled (no changes to `.mcp.json`)
- Commands will work with reduced functionality
- User can run `/configure` again later to enable MCPs

## MCP Dependencies

Some MCPs require external setup:

| MCP | Requirements |
|-----|-------------|
| context7 | None (npm package) |
| sequential-thinking | None (npm package) |
| memory | Creates `.claude/memory/` directory |
| playwright | Installs browsers on first use |