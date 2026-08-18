---
title: Validate MCP server URLs are reachable before configuring
impact: MEDIUM
impactDescription: "Configuring unreachable MCP servers causes silent failures and confusing error messages when skills try to use unavailable tools"
tags: mcp, verification, phase-5, configuration
---

## MCP Server Verification

During Phase 5 (MCP Recommendations), validate that recommended MCP servers are actually reachable or installable before adding them to configuration.

## Problem

Setup recommends and configures a cloud MCP server (e.g., Context7) but the user is behind a corporate proxy or firewall. The server entry is written to `.mcp.json`, but every tool call fails silently. The user sees degraded skill behavior with no clear cause.

**Incorrect -- configure MCP without reachability check:**
```python
# Phase 5: Add recommended MCPs directly
mcp_config = Read(".mcp.json") or {"mcpServers": {}}

# No verification -- assumes network access
# Also picks the stdio transport, which spawns one child process PER SESSION
mcp_config["mcpServers"]["context7"] = {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp@latest"]
}
Write(file_path=".mcp.json", content=json.dumps(mcp_config, indent=2))
# If npx can't reach npm registry, this silently fails at runtime
```

**Correct -- verify before configuring:**
```python
# Phase 5: Verify MCP availability before adding
mcp_config = Read(".mcp.json") or {"mcpServers": {}}

# Prefer the HOSTED transport where upstream publishes one. It has no npm
# dependency and no per-session child process. context7 is the canonical case:
#   {"type": "http", "url": "https://mcp.context7.com/mcp"}
# Reachability for a hosted server is an HTTPS probe, not `npm ping`.
http_check = Bash(command="curl -sS -o /dev/null -w '%{http_code}' -m 10 https://mcp.context7.com/mcp; echo")
hosted_reachable = http_check.strip() != "000"

# For npx-based (stdio) servers: check npm registry reachability
npm_check = Bash(command="npm ping --registry https://registry.npmjs.org 2>&1; echo $?")
npm_available = npm_check.strip().endswith("0")

# For local servers: check if binary exists
local_check = Bash(command="which uvx 2>/dev/null && echo 'available' || echo 'missing'")

recommendations = []
for server in recommended_mcps:
    if server["type"] == "npx" and not npm_available:
        recommendations.append({
            "server": server["name"],
            "status": "skipped",
            "reason": "npm registry unreachable -- check network/proxy settings"
        })
    elif server["type"] == "local" and "missing" in local_check:
        recommendations.append({
            "server": server["name"],
            "status": "skipped",
            "reason": f"Required binary '{server['binary']}' not found -- install it first"
        })
    else:
        recommendations.append({"server": server["name"], "status": "ready"})

# Present results to user before writing config
AskUserQuestion(questions=[{
    "question": f"Configure {len([r for r in recommendations if r['status'] == 'ready'])} available MCP servers?",
    "options": [
        {"label": "Yes", "description": "Add verified servers to .mcp.json"},
        {"label": "Show details", "description": "See full availability report first"},
        {"label": "Skip", "description": "Configure MCPs later via /ork:configure"}
    ]
}])
```

**Key rules:**
- Prefer a hosted HTTP transport when upstream publishes one; fall back to npx stdio only
  when the hosted endpoint is unreachable. stdio costs one child process per Claude Code
  session, so the cost scales with how many sessions the user keeps open
- Run `npm ping` before configuring any npx-based MCP server
- Check for required local binaries (uvx, docker) before configuring local MCP servers
- Mark unreachable servers as "skipped" with a clear reason, not as errors
- Never write an MCP server entry to `.mcp.json` that is known to be unreachable
- Include remediation steps (proxy config, install commands) for skipped servers
- Re-check MCP availability on `--rescan` runs

## Reachability is not authentication

A server that connects is not a server that is authenticated. context7 answers
`tools/list` with HTTP 200 for every auth state: no header, a garbage bearer, an
unexpanded `${CONTEXT7_API_KEY}` literal, or a valid key. Reporting "context7 ready"
from a connection check says nothing about whether the user's key works.

Two consequences for Phase 5:

- Never write an `Authorization` header that references an environment variable the user
  has not exported. The literal `${CONTEXT7_API_KEY}` reaches the server, connects, lists
  two tools, and then fails every query with
  `Invalid API key. Please check your API key. API keys should start with 'ctx7sk' prefix.`
  Omitting the header entirely gives a working free tier instead.
- If a key must be confirmed, confirm it with a real tool call, never with a connection
  or tool-list check.

## context7 is a prerequisite, not a recommendation

22 of the 36 agents grant `mcp__context7__*` in their frontmatter, and OrchestKit ships no
server definition for it (`.mcp.json` is user-owned and gitignored in the plugin repo).
Present context7 as required rather than optional, and state the consequence of declining:
those 22 agents keep working and answer from training data, with no error raised.
