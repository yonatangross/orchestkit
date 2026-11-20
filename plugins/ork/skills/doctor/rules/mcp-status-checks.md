---
title: "MCP Status Checks"
impact: HIGH
impactDescription: "Misconfigured or disabled MCP servers silently break agent capabilities without visible errors"
tags: mcp, configuration, credentials, server-status
---

# MCP Status Checks

Validates `.mcp.json` entries for enabled/disabled state and required credentials.

## Check Procedure

```bash
# Checks performed:
# - Parse .mcp.json, list each server with enabled/disabled state
# - For tavily: check TAVILY_API_KEY env var OR op CLI availability
# - For memory: check MEMORY_FILE_PATH path is writable
# - Flag any enabled MCP whose process would likely fail at startup
# - HIGH-tier @latest pinning: see references/mcp-pinning-check.md
#   (script: scripts/check-mcp-pinning.sh — exit 1 on HIGH-tier @latest)
# - alwaysLoad audit (CC 2.1.121+, #1541): warn when memory, context7, or
#   sequential-thinking lack `"alwaysLoad": true` — these are universally
#   used and per-skill ToolSearch probes are wasted work without it.
#   Skip the warning on CC < 2.1.121 (key would be silently ignored).
# - claude plugin orphans (CC 2.1.121+, #1544): suggest `claude plugin prune`
#   when `claude plugin list --json` shows orphaned auto-installed deps.
# - claude plugin row health (CC 2.1.268+, #4054): each row of the
#   `claude plugin list` JSON output may carry `errorDetails` and
#   `noteDetails`. Both keys are omitted on clean rows (measured on CC
#   2.1.300: zero of the installed rows carried either field), so treat
#   an absent field as empty. Surface every row with a non-empty
#   errorDetails field as a warning (it marks a plugin that errored
#   while loading) and every noteDetails row at info severity. The
#   verdict reports warnings instead of an all-ok line while
#   errorDetails rows exist. Run `claude plugin list --json` first and
#   read these keys from its rows.
# - plugin stdio redaction (CC 2.1.285+): `claude mcp get` hides the command,
#   arguments and environment values of stdio MCP servers provided by plugins
#   (variable names are still shown). A redacted value is unmeasured, not a
#   missing credential: verify the non-secret settings against the plugin
#   manifest or the effective config source, never a personal credential file.
```

**Incorrect:**
```
MCP Servers: all OK
```

**Correct:**
```
MCP Servers:
- context7:  enabled  ✓
- tavily:    enabled  ✗  TAVILY_API_KEY not set — will fail at startup
```

## Output Examples

**Healthy:**
```
MCP Servers:
- context7:           enabled  ✓
- memory:             enabled  ✓
- sequential-thinking: disabled ○
- tavily:             disabled ○  (enable: set TAVILY_API_KEY, see /ork:configure)
```

**Misconfigured (Tavily enabled but no key):**
```
MCP Servers:
- context7:           enabled  ✓
- memory:             enabled  ✓
- tavily:             enabled  ✗  TAVILY_API_KEY not set — MCP will fail at startup
                                  Fix: set TAVILY_API_KEY or set "disabled": true in .mcp.json
```
