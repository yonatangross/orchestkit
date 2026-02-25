---
title: "MCP Status Checks"
impact: HIGH
---

# MCP Status Checks

Validates `.mcp.json` entries for enabled/disabled state and required credentials.

## Check Procedure

```bash
# Checks performed:
# - Parse .mcp.json, list each server with enabled/disabled state
# - For tavily: check TAVILY_API_KEY env var OR op CLI availability
# - For memory: check MEMORY_FILE path is writable
# - For agentation: check agentation-mcp package is installed (npx --yes dry-run)
# - Flag any enabled MCP whose process would likely fail at startup
```

## Output Examples

**Healthy:**
```
MCP Servers:
- context7:           enabled  ✓
- memory:             enabled  ✓
- sequential-thinking: disabled ○
- tavily:             disabled ○  (enable: set TAVILY_API_KEY, see /ork:configure)
- agentation:         disabled ○
```

**Misconfigured (Tavily enabled but no key):**
```
MCP Servers:
- context7:           enabled  ✓
- memory:             enabled  ✓
- tavily:             enabled  ✗  TAVILY_API_KEY not set — MCP will fail at startup
                                  Fix: set TAVILY_API_KEY or set "disabled": true in .mcp.json
```

**Misconfigured (agentation enabled but not installed):**
```
MCP Servers:
- agentation:         enabled  ✗  agentation-mcp package not found
                                  Fix: npm install -D agentation-mcp  or  set "disabled": true
```
