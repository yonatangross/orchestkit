# Doctor Report Format

## ASCII Report

**Full ork plugin:**
```
+===================================================================+
|                    OrchestKit Health Report                        |
+===================================================================+
| Version: {version}  |  CC: {cc_version}  |  Plugins: ork          |
+===================================================================+
| Skills           | 67/67 valid                                    |
| Agents           | 37/37 valid                                    |
| Hooks            | 87/87 entries (12 bundles)                     |
| Memory           | Graph memory healthy                           |
| MCP              | context7 ✓  memory ✓  tavily ○  agentation ○  |
| Permissions      | 12/12 reachable                                |
| Schemas          | 15/15 compliant                                |
| Context          | 1850/2200 tokens (84%)                         |
| Coordination     | 0 stale locks                                  |
| CC Version       | {cc_version} (OK)                              |
+===================================================================+
| Status: HEALTHY (10/10 checks passed)                             |
+===================================================================+
```

> **Note:** `{version}` is read from `package.json` at runtime. `{cc_version}` is detected from Claude Code. Counts reflect installed plugin — dynamic, not hardcoded.

**orkl plugin (lite):**
```
+===================================================================+
|                    OrchestKit Health Report                        |
+===================================================================+
| Version: {version}  |  CC: {cc_version}  |  Plugins: orkl         |
+===================================================================+
| Skills           | 45/45 valid                                    |
| Agents           | 36/36 valid                                    |
| Hooks            | 87/87 entries (12 bundles)                     |
| Memory           | Graph memory healthy                           |
+===================================================================+
```

## JSON Output (CI Integration)

```bash
/ork:doctor --json
```

```json
{
  "version": "{version}",
  "claudeCode": "{cc_version}",
  "status": "healthy",
  "plugins": {
    "installed": ["ork"],
    "count": 1
  },
  "checks": {
    "skills": {"passed": true, "count": 67, "perPlugin": {"ork": 67}},
    "agents": {"passed": true, "count": 37, "perPlugin": {"ork": 37}},
    "hooks": {"passed": true, "entries": 87, "bundles": 12, "source": "ork"},
    "memory": {"passed": true, "available": ["graph"]},
    "mcp": {"passed": true, "servers": {"context7": "enabled", "memory": "enabled", "sequential-thinking": "disabled", "tavily": "disabled", "agentation": "disabled"}},
    "permissions": {"passed": true, "count": 12},
    "schemas": {"passed": true, "count": 15},
    "context": {"passed": true, "usage": 0.84},
    "coordination": {"passed": true, "staleLocks": 0},
    "ccVersion": {"passed": true, "version": "2.1.47"}
  },
  "exitCode": 0
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks pass |
| 1 | One or more checks failed |
