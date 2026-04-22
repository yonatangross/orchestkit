# MCP Audit Runbook

Operational procedure for re-running the MCP version audit documented in `mcp-version-matrix.md`.

## When to run

- **Calendar trigger:** every 90 days from the last audit's "Last audited" header
- **Event trigger:** when a consumer skill reports unexpected MCP behavior
- **Release trigger:** before every minor OrchestKit release (pin HIGH-tier servers if drift detected)

## Re-run script

```bash
# From repo root
for pkg in @upstash/context7-mcp @modelcontextprotocol/server-sequential-thinking \
           @modelcontextprotocol/server-memory tavily-mcp agentation-mcp \
           @21st-dev/magic fal-ai-mcp notebooklm-mcp; do
  v=$(npm view "$pkg" version 2>/dev/null)
  pub=$(npm view "$pkg" time.modified 2>/dev/null | head -1)
  printf "%-50s %-15s %s\n" "$pkg" "$v" "$pub"
done
```

## Interpreting output

Compare the script output to the "Upstream latest" column in `mcp-version-matrix.md`.

| Drift observed | Action |
|---|---|
| No change | Update "Last audited" header in matrix. Done. |
| Patch bump on any tier | Update matrix. No consumer-side action needed. |
| Minor bump on LOW/MEDIUM | Update matrix. Spot-check the package's release notes for regressions that affect current usage patterns. |
| Minor bump on HIGH | Read the full changelog. If breaking, file an issue to pin the previous version in `.mcp.json` and adapt consumer skills. |
| Major bump on any tier | Read the changelog. Treat as a potentially-breaking event regardless of tier. |
| Package unpublished / yanked | File urgent issue. Pin to last-known-good in `.mcp.json`. |

## Updating the matrix

After each audit:
1. Update the "Upstream latest" and "Last published" columns
2. Update the "Last audited" header with today's date
3. If tier classification changes (e.g., a 0.x server hits 1.0), update the Risk Tier table
4. Commit with message `chore: refresh MCP version audit matrix ({YYYY-MM-DD})`

## When to escalate to a full consumer audit

Trigger a consumer-side review (read every `mcp__<name>__*` call site) when any of:
- MCP upstream emits a major version bump
- Upstream changelog mentions "breaking" or "removed"
- A skill's MCP-using phase starts failing in production after the fetch
- npm publishes a new package under the same scope (namespace squat check)

## Escape hatch: pin a specific version

To freeze a server at a known-good version, edit `.mcp.json`:

```diff
 "context7": {
   "command": "npx",
-  "args": ["-y", "@upstash/context7-mcp@latest"]
+  "args": ["-y", "@upstash/context7-mcp@2.1.8"]
 }
```

Document the pin reason in `mcp-version-matrix.md` under the affected row. Remove the pin once the reason is resolved (e.g., upstream ships a fix, your consumer code adapts to the new API).

## Related

- `mcp-version-matrix.md` — the current-state matrix this runbook maintains
- `.mcp.json` — the target of pin changes
- Issue #1462 — doctor check that will warn when HIGH-tier servers are unpinned
