# MCP Configuration

MCPs (Model Context Protocol servers) enhance OrchestKit commands but are **NOT required**.
Commands work without them - MCPs just add extra capabilities.

## Available MCPs

| MCP | Purpose | Storage | Enhances |
|-----|---------|---------|----------|
| **context7** | Up-to-date library docs | Cloud (Upstash) | /implement, /verify, /review-pr |
| **sequential-thinking** | Structured reasoning | None | /brainstorm, /implement |

> **Opus 4.6 Note:** Sequential-thinking MCP is optional when using Opus 4.6+, which has native adaptive thinking built-in. The MCP tool remains useful for non-Opus models.
| **memory** | Knowledge graph | Local file | Decisions, patterns, entities |

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
      "disabled": false
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-server-sequential-thinking"],
      "disabled": true
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-server-memory"],
      "env": { "MEMORY_FILE": ".claude/memory/memory.json" },
      "disabled": false
    }
  }
}
```

## MCP Dependencies

| MCP | Requirements |
|-----|-------------|
| context7 | None |
| sequential-thinking | None |
| memory | None (creates `.claude/memory/` automatically) |

## Plugin Integration

OrchestKit hooks integrate with these MCPs:

| Hook | MCP Used | Purpose |
|------|----------|---------|
| Skills use | context7 | Fetch current library docs |

## Without MCPs

Commands still work - MCPs just enhance them:
- `/implement` works, but without latest library docs (context7)
- Session continuity works via local files and knowledge graph

## Browser Automation

For browser automation and testing, use the `agent-browser` skill instead of an MCP.
See `/ork:agent-browser` for Vercel's headless browser CLI.