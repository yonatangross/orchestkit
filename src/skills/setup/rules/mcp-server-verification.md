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

# For npx-based servers: check npm registry reachability
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
- Run `npm ping` before configuring any npx-based MCP server
- Check for required local binaries (uvx, docker) before configuring local MCP servers
- Mark unreachable servers as "skipped" with a clear reason, not as errors
- Never write an MCP server entry to `.mcp.json` that is known to be unreachable
- Include remediation steps (proxy config, install commands) for skipped servers
- Re-check MCP availability on `--rescan` runs
