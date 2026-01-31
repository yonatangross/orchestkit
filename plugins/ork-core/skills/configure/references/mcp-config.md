# MCP Configuration

MCPs (Model Context Protocol servers) enhance OrchestKit commands but are **NOT required**.
Commands work without them - MCPs just add extra capabilities.

## Available MCPs

| MCP | Purpose | Storage | Enhances |
|-----|---------|---------|----------|
| **context7** | Up-to-date library docs | Cloud (Upstash) | /implement, /verify, /review-pr |
| **sequential-thinking** | Structured reasoning | None | /brainstorm, /implement |
| **mem0** | Semantic memory | Cloud (mem0.ai) | Session continuity, decisions |
| **memory** | Simple key-value storage | Local file | Quick notes, preferences |
| **playwright** | Browser automation | Local | /verify, content capture |

## Memory Options: mem0 vs memory

| Feature | mem0 | memory |
|---------|------|--------|
| **Storage** | Cloud (mem0.ai) | Local file |
| **Search** | Semantic/AI-powered | Exact match |
| **Scope** | Per-project, organized | Single file |
| **Setup** | Needs API key | Zero config |
| **Use case** | Long-term decisions | Quick notes |

**Recommendation:**
- Use **mem0** for important decisions, patterns, architecture choices
- Use **memory** for quick preferences and simple notes
- Both can be enabled simultaneously

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
    "mem0": {
      "command": "npx",
      "args": ["-y", "mem0-mcp"],
      "env": { "MEM0_API_KEY": "${MEM0_API_KEY}" },
      "disabled": false
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-server-memory"],
      "env": { "MEMORY_FILE": ".claude/memory/memory.json" },
      "disabled": false
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropics/mcp-server-playwright"],
      "disabled": true
    }
  }
}
```

## MCP Dependencies

| MCP | Requirements |
|-----|-------------|
| context7 | None |
| sequential-thinking | None |
| mem0 | `MEM0_API_KEY` environment variable |
| memory | None (creates `.claude/memory/` automatically) |
| playwright | Installs browsers on first use |

## Mem0 Setup

1. Get API key from [mem0.ai](https://mem0.ai)
2. Set environment variable: `export MEM0_API_KEY=your-key`
3. Enable in `.mcp.json`

## Plugin Integration

OrchestKit hooks integrate with these MCPs:

| Hook | MCP Used | Purpose |
|------|----------|---------|
| `mem0-context-retrieval.sh` | mem0 | Load previous session context |
| `mem0-pre-compaction-sync.sh` | mem0 | Save decisions before session end |
| Skills use | context7 | Fetch current library docs |

## Without MCPs

Commands still work - MCPs just enhance them:
- `/implement` works, but without latest library docs (context7)
- Session continuity works via local files, not semantic search (mem0)
- Browser testing requires manual setup (playwright)