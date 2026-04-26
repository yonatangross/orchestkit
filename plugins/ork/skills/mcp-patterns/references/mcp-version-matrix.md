# MCP Version Matrix

Tracks OrchestKit's integrated MCP servers against upstream latest. Sourced from `.mcp.json` (project-level) and documented user-level integrations.

**Last audited:** 2026-04-26 (refresh after M117 + M122; pins HIGH-tier `21st-dev-magic`)

## Audit Method

1. `.mcp.json` enumerates project-level servers
2. `npm view <pkg> version` + `time.modified` for each
3. Primary consumer located via `grep -rln "mcp__<name>__"` in `src/skills/` and `src/agents/`

## Matrix

| MCP server | Package | Pin in `.mcp.json` | Upstream latest | Last published | Δ since prior audit | Primary consumer | Status |
|---|---|---|---|---|---|---|---|
| **context7** | `@upstash/context7-mcp` | `@latest` | **2.2.0** | 2026-04-24 | 2.1.8 → 2.2.0 (minor) | Many (chain-patterns, implement, fix-issue, cover, ...) | Active, recent release |
| **sequential-thinking** | `@modelcontextprotocol/server-sequential-thinking` | unpinned | **2025.12.18** | 2026-02-06 | unchanged | chain-patterns, brainstorm, setup | Stable, calendar-versioned |
| **memory** | `@modelcontextprotocol/server-memory` | unpinned | **2026.1.26** | 2026-02-06 | unchanged | 46 files (cross-cutting) | Stable, calendar-versioned |
| **tavily** | `tavily-mcp` | `@latest` | **0.2.19** | 2026-04-24 | 0.2.18 → 0.2.19 (patch) | chain-patterns fallback (tier-fallbacks.md) | Low direct usage |
| **agentation** | `agentation-mcp` | `@latest` (disabled) | **1.2.0** | 2026-02-15 | unchanged | `agents/ui-feedback.md`, `skills/verify` | Disabled by default in `.mcp.json` |
| **21st-dev-magic** | `@21st-dev/magic` | **`@0.1.0` (pinned)** | **0.1.0** | 2025-12-23 | unchanged | None in core (mentioned as option in `component-search`) | Pre-1.0, stale upstream — pinned 2026-04-26 to lock current state |
| **fal** | `fal-ai-mcp` | `@latest` | **0.2.1** | 2026-03-07 | unchanged | None in core (available for multimodal skills) | Active upstream |
| **ork-elicit** | local `plugins/ork/mcp-server/server.mjs` | n/a (local) | n/a | versioned with repo | n/a | All skills via elicitation | In-tree, no external pin |

## User-level MCPs (referenced but not in project `.mcp.json`)

| MCP server | Package | Referenced by | Note |
|---|---|---|---|
| **notebooklm-mcp** | `notebooklm-mcp` (upstream **1.2.1**, 2025-12-27, unchanged) | `src/skills/release-sync/SKILL.md` | Configured user-level in `~/.claude.json`; `release-sync` assumes availability |

## Status: One HIGH-Tier Server Pinned, Rest on `@latest`

Of 7 active remote MCPs, 1 is now version-pinned (`@21st-dev/magic@0.1.0`) and 6 still resolve to `@latest`. The pinning of the HIGH-tier server addresses the original audit's primary risk: a breaking pre-1.0 upstream change can no longer propagate silently on the next `npx -y` fetch.

**Remaining MEDIUM-tier @latest entries** (`context7`, `tavily`, `fal`) are intentionally left on `@latest` — they're semver-disciplined upstream and benefit from automatic patch/minor uptake. The doctor check (`/ork:doctor` Category 12 sub-check) emits an informational note but does not warn, matching the tier policy.

## Risk Tier (unchanged)

| Tier | Criteria | Servers |
|---|---|---|
| **LOW** | Stable API, calendar-versioned, low release velocity | `sequential-thinking`, `memory` |
| **MEDIUM** | Active upstream, semver, used in many skills | `context7`, `tavily`, `fal` |
| **HIGH** | Pre-1.0 upstream, API may change without notice | `21st-dev-magic` (0.1.0, **now pinned**), `agentation` (1.2.0 beta surface, **disabled**) |

## Recommendations Status

| # | Action | Status | Notes |
|---|---|---|---|
| 1 | Pin HIGH-tier servers to concrete versions in `.mcp.json` | **DONE** (2026-04-26) | `21st-dev-magic` pinned to `@0.1.0`; `agentation` already disabled |
| 2 | Add an `ork:doctor` check that warns when `.mcp.json` uses `@latest` on HIGH-tier servers | **DONE** (M117 #1462) | Implemented in `src/skills/doctor/scripts/check-mcp-pinning.sh` (PR #1496) |
| 3 | Document in `ork:release-sync` that NotebookLM MCP is user-configured and not auto-installed | OPEN | Small skill edit, low priority |
| 4 | Re-run this audit every 90 days; update `Last audited` header | RECURRING | Next due: 2026-07-25 |
| 5 *(new)* | Re-evaluate `agentation` HIGH→MEDIUM tier after upstream stabilizes (still beta surface as of 1.2.0, 2026-02-15) | OPEN | Re-check at 2026-07-25 audit |

## Audit Cadence Calibration

The 90-day cadence is appropriate. Between audits 1 (2026-04-22) and 2 (2026-04-26, this refresh), only 4 days elapsed but 2 patch-level upstream changes landed (`context7 2.2.0`, `tavily 0.2.19`) — both auto-uptaken via `@latest`, no user action required. The 90-day cadence catches *tier reclassification* signals (e.g., a server going stale, hitting 1.0.0, or losing maintainer activity), not version-tracking — which `@latest` handles continuously.

## How to Re-run This Audit

See `mcp-audit-runbook.md` (sibling reference) for the re-run script, interpretation rules, and when to escalate a drift. One-liner refresh:

```bash
for pkg in @upstash/context7-mcp tavily-mcp fal-ai-mcp @21st-dev/magic agentation-mcp \
           @modelcontextprotocol/server-sequential-thinking @modelcontextprotocol/server-memory \
           notebooklm-mcp; do
  v=$(npm view "$pkg" version 2>/dev/null)
  pub=$(npm view "$pkg" time.modified 2>/dev/null)
  printf "%-50s %-12s %s\n" "$pkg" "${v:-???}" "${pub:-unknown}"
done
```

## References

- `.mcp.json` — project-level MCP server config
- `~/.claude.json` — user-level MCP server config (not in repo)
- Issue #1446 — the audit request that produced this matrix
- PR #1496 (M117) — `/ork:doctor` MCP pinning sub-check
- `src/skills/mcp-patterns/SKILL.md` — skill that owns this reference
- `src/skills/doctor/references/mcp-pinning-check.md` — tier source-of-truth for the doctor check
- `mcp-audit-runbook.md` — the operational procedure
