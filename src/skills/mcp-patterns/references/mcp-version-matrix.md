# MCP Version Matrix

Tracks OrchestKit's integrated MCP servers against upstream latest. Sourced from `.mcp.json` (project-level) and documented user-level integrations.

**Last audited:** 2026-04-22 (closes #1446)

## Audit Method

1. `.mcp.json` enumerates project-level servers
2. `npm view <pkg> version` + `time.modified` for each
3. Primary consumer located via `grep -rln "mcp__<name>__"` in `src/skills/` and `src/agents/`

## Matrix

| MCP server | Package | Pin in `.mcp.json` | Upstream latest | Last published | Primary consumer | Status |
|---|---|---|---|---|---|---|
| **context7** | `@upstash/context7-mcp` | `@latest` | **2.1.8** | 2026-04-13 | Many (chain-patterns, implement, fix-issue, cover, ...) | Active, recent release |
| **sequential-thinking** | `@modelcontextprotocol/server-sequential-thinking` | unpinned | **2025.12.18** | 2026-02-06 | chain-patterns, brainstorm, setup | Stable, calendar-versioned |
| **memory** | `@modelcontextprotocol/server-memory` | unpinned | **2026.1.26** | 2026-02-06 | 46 files (cross-cutting) | Stable, calendar-versioned |
| **tavily** | `tavily-mcp` | `@latest` | **0.2.18** | 2026-03-12 | chain-patterns fallback (tier-fallbacks.md) | Low direct usage |
| **agentation** | `agentation-mcp` | `@latest` (disabled) | **1.2.0** | 2026-02-15 | `agents/ui-feedback.md`, `skills/verify` | Disabled by default in `.mcp.json` |
| **21st-dev-magic** | `@21st-dev/magic` | `@latest` | **0.1.0** | 2025-12-23 | None in core (mentioned as option in `component-search`) | Pre-1.0, stale upstream |
| **fal** | `fal-ai-mcp` | `@latest` | **0.2.1** | 2026-03-07 | None in core (available for multimodal skills) | Active upstream |
| **ork-elicit** | local `plugins/ork/mcp-server/server.mjs` | n/a (local) | n/a | versioned with repo | All skills via elicitation | In-tree, no external pin |

## User-level MCPs (referenced but not in project `.mcp.json`)

| MCP server | Package | Referenced by | Note |
|---|---|---|---|
| **notebooklm-mcp** | `notebooklm-mcp` (upstream **1.2.1**, 2025-12-27) | `src/skills/release-sync/SKILL.md` | Configured user-level in `~/.claude.json`; `release-sync` assumes availability |

## Key Finding: No Project-Level Pinning

Every remote MCP in `.mcp.json` resolves to `@latest` (or no version, which npm treats as latest). **OrchestKit has no version-pin drift to measure** — it always fetches current upstream.

**Implication:** a breaking upstream change propagates on the next `npx -y` fetch without warning. The audit question shifts from "are we behind?" to "do we get notified when upstream breaks?"

## Risk Tier

| Tier | Criteria | Servers |
|---|---|---|
| **LOW** | Stable API, calendar-versioned, low release velocity | `sequential-thinking`, `memory` |
| **MEDIUM** | Active upstream, semver, used in many skills | `context7`, `tavily`, `fal` |
| **HIGH** | Pre-1.0 upstream, API may change without notice | `21st-dev-magic` (0.1.0), `agentation` (1.2.0, still beta surface) |

## Recommendations

| # | Action | Owner | Priority |
|---|---|---|---|
| 1 | Pin HIGH-tier servers to concrete versions in `.mcp.json` | Follow-up issue | MEDIUM |
| 2 | Add an `ork:doctor` check that warns when `.mcp.json` uses `@latest` on HIGH-tier servers | Follow-up issue (split from #1446) | MEDIUM |
| 3 | Document in `ork:release-sync` that NotebookLM MCP is user-configured and not auto-installed | Small skill edit | LOW |
| 4 | Re-run this audit every 90 days; update `Last audited` header | Calendar reminder or CI cron | LOW |

## How to Re-run This Audit

```bash
# From repo root
for pkg in @upstash/context7-mcp @modelcontextprotocol/server-sequential-thinking \
           @modelcontextprotocol/server-memory tavily-mcp agentation-mcp \
           @21st-dev/magic fal-ai-mcp notebooklm-mcp; do
  v=$(npm view "$pkg" version 2>/dev/null)
  pub=$(npm view "$pkg" time.modified 2>/dev/null | head -1)
  printf "%-50s %-15s %s\n" "$pkg" "$v" "$pub"
done

# Compare output against this file's "Upstream latest" column.
# For each drift > 1 minor: read the package's CHANGELOG for breaking changes.
```

## References

- `.mcp.json` — project-level MCP server config
- `~/.claude.json` — user-level MCP server config (not in repo)
- Issue #1446 — the audit request that produced this matrix
- `src/skills/mcp-patterns/SKILL.md` — skill that owns this reference
