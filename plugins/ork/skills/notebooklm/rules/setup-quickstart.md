---
title: "NotebookLM Quick Setup"
impact: HIGH
impactDescription: "Without proper auth setup, all MCP tool calls fail silently"
tags: [auth, setup, mcp-config]
---

## Quick Setup

Authenticate with Google via `nlm login`, then register the MCP server with Claude Code. Auth sessions expire after ~20 minutes of inactivity. Supports any Chromium-based browser (Chrome, Arc, Brave, Edge, Vivaldi, Opera).

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

**Browser preference** (v0.3.17+):
```bash
# Set preferred browser (auto-detected by default)
nlm config set auth.browser arc    # arc | chrome | brave | edge | vivaldi | opera | auto

# Or via environment variable
export NLM_BROWSER=arc
```

**Key rules:**
- Always authenticate with `nlm login` before first use -- browser OAuth flow required
- Auth sessions last ~20 minutes; re-run `nlm login` if tools start failing
- Use `nlm login --check` to verify session status before long workflows
- Prefer `nlm setup add claude-code` over manual .mcp.json editing
- If setup command fails, use the manual .mcp.json fallback with `"command": "nlm"`
- Any Chromium-based browser works: Chrome, Arc, Brave, Edge, Chromium, Vivaldi, Opera
- Set a preferred browser with `nlm config set auth.browser <name>` or `NLM_BROWSER` env var
