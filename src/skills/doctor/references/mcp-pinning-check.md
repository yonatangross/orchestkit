# MCP Pinning Check (Category 12 sub-check)

Warns when `.mcp.json` resolves HIGH-tier MCP servers to `@latest`. HIGH-tier
upstream packages are pre-1.0 or beta-surface — a breaking change can land on
any `npx -y` fetch with no signal.

**Closes:** #1462. Split from #1446 (MCP audit).

## Tier Source-of-Truth

`src/skills/mcp-patterns/references/mcp-version-matrix.md`

| Tier | Criteria | Packages |
|---|---|---|
| **HIGH** | Pre-1.0 upstream, API may change without notice | `@21st-dev/magic`, `agentation-mcp` |
| **MEDIUM** | Active upstream, semver, used in many skills | `@upstash/context7-mcp`, `tavily-mcp`, `fal-ai-mcp` |
| **LOW** | Stable API, calendar-versioned | `@modelcontextprotocol/server-sequential-thinking`, `@modelcontextprotocol/server-memory` |

## Detection

The check parses `.mcp.json` and for each non-disabled entry extracts the npm
package + version specifier from `args` (handles both `npx -y pkg@x` and
`sh -c "... npx -y pkg@x"` shapes). Local servers (e.g., `node ./server.mjs`)
are skipped.

For each enabled remote server:

| Spec | Tier | Behavior |
|---|---|---|
| `pkg@<concrete>` | any | OK |
| `pkg` or `pkg@latest` | HIGH | **WARN** (exit 1) |
| `pkg` or `pkg@latest` | MEDIUM | informational only (exit 0) |
| `pkg` or `pkg@latest` | LOW | silent (exit 0) |

## Output

**HIGH-tier @latest detected:**
```
MCP pinning: 2 HIGH-tier server(s) resolve to @latest
    ⚠ 21st-dev-magic (@21st-dev/magic)
    ⚠ agentation (agentation-mcp)
    → Consider pinning to concrete versions in .mcp.json
    → See src/skills/mcp-patterns/references/mcp-version-matrix.md
```

**MEDIUM-tier only:**
```
MCP pinning: 3 MEDIUM-tier server(s) at @latest (informational)
    ℹ context7 (@upstash/context7-mcp)
    ℹ tavily (tavily-mcp)
    ℹ fal (fal-ai-mcp)
```

**OK:**
```
MCP pinning: OK (no HIGH-tier @latest entries)
```

## Script

`src/skills/doctor/scripts/check-mcp-pinning.sh` — invokable standalone or via
`/ork:doctor` Category 12.

```bash
# Standalone
src/skills/doctor/scripts/check-mcp-pinning.sh

# JSON for CI
src/skills/doctor/scripts/check-mcp-pinning.sh --json

# Test fixture
src/skills/doctor/scripts/check-mcp-pinning.sh --mcp-json /tmp/test.json
```

Exit codes: `0` = OK or absent, `1` = HIGH-tier @latest found, `2` = usage error.

## Tests

`tests/skills/test-mcp-pinning-check.sh` — 18 assertions across 7 fixtures
covering HIGH/MEDIUM/LOW tier classification, disabled entries, local servers,
JSON output shape, and missing-file handling.
