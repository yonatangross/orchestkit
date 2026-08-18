# MCP Version Matrix

Tracks OrchestKit's integrated MCP servers against upstream latest. Sourced from `.mcp.json` (project-level, user-owned) and documented user-level integrations.

**Last audited:** 2026-08-18 (context7 refresh: 2.2.0 was two majors stale; hosted HTTP recorded as the recommended transport)

## Audit Method

1. `.mcp.json` enumerates project-level servers
2. `npm view <pkg> version` + `time.modified` for each
3. Primary consumer located via `grep -rln "mcp__<name>__"` in `src/skills/` and `src/agents/`

## Matrix

| MCP server | Package | Pin in `.mcp.json` | Upstream latest | Last published | Δ since prior audit | Primary consumer | Status |
|---|---|---|---|---|---|---|---|
| **context7** | `@upstash/context7-mcp` (stdio) **or** hosted `https://mcp.context7.com/mcp` | `@latest`, hosted URL unversioned | **4.0.2** | 2026-08-11 | 2.2.0 → 4.0.2 (**two majors**) | 22 of 36 agents, plus chain-patterns, implement, fix-issue, cover | Active. Both majors expose the **same two tools**, so the bump grants nothing new |
| **sequential-thinking** | `@modelcontextprotocol/server-sequential-thinking` | unpinned | **2025.12.18** | 2026-02-06 | unchanged | chain-patterns, brainstorm, setup | Stable, calendar-versioned |
| **memory** | `@modelcontextprotocol/server-memory` | unpinned | **2026.1.26** | 2026-02-06 | unchanged | 46 files (cross-cutting) | Stable, calendar-versioned |
| **tavily** | `tavily-mcp` | `@latest` | **0.2.19** | 2026-04-24 | 0.2.18 → 0.2.19 (patch) | chain-patterns fallback (tier-fallbacks.md) | Low direct usage |
| **21st-dev-magic** | `@21st-dev/magic` | **`@0.1.0` (pinned)** | **0.1.0** | 2025-12-23 | unchanged | None in core (mentioned as option in `component-search`) | Pre-1.0, stale upstream — pinned 2026-04-26 to lock current state |
| **fal** | `fal-ai-mcp` | `@latest` | **0.2.1** | 2026-03-07 | unchanged | None in core (available for multimodal skills) | Active upstream |

## User-level MCPs (referenced but not in project `.mcp.json`)

| MCP server | Package | Referenced by | Note |
|---|---|---|---|
| **notebooklm-mcp** | `notebooklm-mcp-cli` (PyPI, **0.6.1**, 2026-04-28) — installed via `uv tool install notebooklm-mcp-cli`; ships both `nlm` CLI and `notebooklm-mcp` MCP server. NOTE: the npm `notebooklm-mcp@1.2.1` (2025-12-27) is a separate, stale package — do NOT use it. | `src/skills/release-sync/SKILL.md`, `src/skills/notebooklm/SKILL.md` | Configured user-level in `~/.claude.json`; `release-sync` assumes availability |

## Status: One HIGH-Tier Server Pinned, Rest on `@latest`

Of 6 active remote MCPs, 1 is now version-pinned (`@21st-dev/magic@0.1.0`) and 5 still resolve to `@latest`. The pinning of the HIGH-tier server addresses the original audit's primary risk: a breaking pre-1.0 upstream change can no longer propagate silently on the next `npx -y` fetch.

**Remaining MEDIUM-tier @latest entries** (`context7`, `tavily`, `fal`) are intentionally left on `@latest` — they're semver-disciplined upstream and benefit from automatic patch/minor uptake. The doctor check (`/ork:doctor` Category 12 sub-check) emits an informational note but does not warn, matching the tier policy.

## Transport: hosted HTTP is the recommendation for context7

context7 publishes a hosted server at `https://mcp.context7.com/mcp`, and that is the
transport to recommend:

```json
"context7": { "type": "http", "url": "https://mcp.context7.com/mcp" }
```

npx stdio remains supported and is the fallback for proxied or air-gapped networks, but
**it costs one child process per Claude Code session**, because the client spawns the
server. On a machine running ten concurrent sessions that is ten `npx` children resolving
and running the package, per project.

Two consequences for this matrix:

- A hosted entry has **no npm version to pin**. `check-mcp-pinning.sh` finds no package
  token in it and classifies the server as `<unknown>`, which it skips. That is correct
  behaviour, not a regression: version pinning is a property of the npx transport only.
- The version column above still matters for the stdio fallback. `4.0.2` is the concrete
  pin to use when one is needed.

### Tool surface (unchanged across 2.x, 3.x, and 4.x)

| Tool | Purpose |
|---|---|
| `mcp__context7__resolve-library-id` | Map a package name to a Context7 library id |
| `mcp__context7__query-docs` | Fetch scoped documentation for a resolved library |

Exactly two, on every published version. Any other spelling grants nothing and fails
silently, so a version bump is never a reason to rewrite a tool name.

### Tier and key

Free is 1,000 requests against public repositories, with no key. Context7 Pro is $10 per
seat per month for 5,000 requests per seat plus private repo parsing, then $10 per
additional 1,000. Keys have the form `ctx7sk-...` and are supplied as
`Authorization: Bearer ${CONTEXT7_API_KEY}` on the hosted transport or `--api-key` on
stdio. Never write a literal key into a tracked file.

**Auth caveat.** `tools/list` returns HTTP 200 for every auth state (no header, garbage bearer,
unexpanded `${CONTEXT7_API_KEY}` literal, valid key), so a connection check can never
confirm a key. Only `tools/call` discriminates: a bad key returns
`Invalid API key. Please check your API key. API keys should start with 'ctx7sk' prefix.`

**No anonymous fallback.** Hosted plus bearer is a hard dependency on `CONTEXT7_API_KEY`
being exported. With it unset, the unexpanded literal is transmitted as the token and every
`tools/call` fails; the server does not fall back to the free tier. Keyless hosted (no
`headers` block) is a working free tier, so an unexported key is worse than no header.

## Risk Tier (unchanged)

| Tier | Criteria | Servers |
|---|---|---|
| **LOW** | Stable API, calendar-versioned, low release velocity | `sequential-thinking`, `memory` |
| **MEDIUM** | Active upstream, semver, used in many skills | `context7`, `tavily`, `fal` |
| **HIGH** | Pre-1.0 upstream, API may change without notice | `21st-dev-magic` (0.1.0, **now pinned**) |

## Recommendations Status

| # | Action | Status | Notes |
|---|---|---|---|
| 1 | Pin HIGH-tier servers to concrete versions in `.mcp.json` | **DONE** (2026-04-26) | `21st-dev-magic` pinned to `@0.1.0` |
| 2 | Add an `ork:doctor` check that warns when `.mcp.json` uses `@latest` on HIGH-tier servers | **DONE** (M117 #1462) | Implemented in `src/skills/doctor/scripts/check-mcp-pinning.sh` (PR #1496) |
| 3 | Document in `ork:release-sync` that NotebookLM MCP is user-configured and not auto-installed | OPEN | Small skill edit, low priority |
| 4 | Re-run this audit every 90 days; update `Last audited` header | RECURRING | Next due: 2026-11-16 (last run 2026-08-18; the 2026-07-25 slot was missed, which is how context7 drifted two majors) |

## Audit Cadence Calibration

**Revised 2026-08-18: the 90-day cadence is only appropriate if it is actually run.**

The earlier version of this note argued the cadence was fine because `@latest` handles
version tracking continuously, leaving the audit to catch tier-reclassification signals
(a server going stale, hitting 1.0.0, or losing maintainer activity). Between audits 1
(2026-04-22) and 2 (2026-04-26) that held: two patch-level changes landed
(`context7 2.2.0`, `tavily 0.2.19`) and both were auto-uptaken with no user action.

What actually happened next falsifies the comfortable half of that argument. The
2026-07-25 slot was missed, and by 2026-08-18 this matrix still said context7's latest
was `2.2.0` while npm said `4.0.2`: **two major versions of documented drift**, roughly
four months stale. `@latest` did keep fetching the new code, so runtime was never wrong;
the *documentation* was, which is exactly the failure a version matrix exists to prevent.
It also hid a transport change worth knowing about (a hosted HTTP server now exists).

Keep the 90-day cadence, and treat a missed slot as a defect rather than a slip. Two
mitigations that cost nothing:

- Record the next due date in the Recommendations table (done) so a missed run is visible
  in the file itself rather than only in someone's calendar.
- Audit the **transport** alongside the version. A major bump that changes no tool name is
  low-risk; a new hosted endpoint that removes a per-session child process is not, and the
  version column alone would never have surfaced it.

## How to Re-run This Audit

See `mcp-audit-runbook.md` (sibling reference) for the re-run script, interpretation rules, and when to escalate a drift. One-liner refresh:

```bash
for pkg in @upstash/context7-mcp tavily-mcp fal-ai-mcp @21st-dev/magic \
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
