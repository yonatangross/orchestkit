---
title: "NotebookLM Quick Setup"
impact: HIGH
impactDescription: "Without proper auth setup, all MCP tool calls fail silently"
tags: [auth, setup, mcp-config]
---

## Quick Setup

Authenticate with Google via `nlm login`, then register the MCP server with Claude Code. Auth sessions expire after ~20 minutes of inactivity.

**Incorrect -- manually editing .mcp.json with wrong server path:**
```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "node",
      "args": ["./some/wrong/path/server.js"]
    }
  }
}
```

**Correct -- using CLI setup command:**
```bash
# 1. Authenticate (opens browser for Google OAuth)
nlm login

# 2. Register MCP server with Claude Code
nlm setup add claude-code

# 3. Verify auth is active
nlm login --check
```

**Manual .mcp.json fallback** (if `nlm setup` is unavailable):
```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "nlm",
      "args": ["mcp"]
    }
  }
}
```

**Alternative -- skill-based install:**
```bash
nlm skill install
```

**Key rules:**
- Always authenticate with `nlm login` before first use -- browser OAuth flow required
- Auth sessions last ~20 minutes; re-run `nlm login` if tools start failing
- Use `nlm login --check` to verify session status before long workflows
- Prefer `nlm setup add claude-code` over manual .mcp.json editing
- If setup command fails, use the manual .mcp.json fallback with `"command": "nlm"`
