---
title: "Diagnostic Checks"
impact: CRITICAL
impactDescription: "Skipping health checks lets broken configs, missing deps, and stale hooks go undetected"
tags: diagnostics, health-check, plugin-validation, troubleshooting
---

# Diagnostic Check Procedures

Detailed procedures for each health check category in `/ork:doctor`.

---

**Incorrect:**
```
✓ Plugins OK    (no actual validation — just assumed healthy)
```

**Correct:**
```
✓ Skills: 69/69 valid (frontmatter, token budget, links)
✗ Hooks: dist/memory-writer.mjs missing — run: cd src/hooks && npm run build
✓ Agents: 38/38 CC 2.1.6 compliant
```

## 0. Installed Plugins Detection

Auto-detects which OrchestKit plugins are installed:

```bash
# Detection logic:
# - Scans for .claude-plugin/plugin.json in plugin paths
# - Identifies ork plugin
# - Counts skills/agents per installed plugin
```

---

## 1. Skills Validation

Validates skills in installed plugins (count varies by installation):

```bash
# Checks performed:
# - SKILL.md frontmatter (name, description, user-invocable)
# - context: fork field (required for CC 2.1.0+)
# - Token budget compliance (300-5000 tokens)
# - Internal link validation (references/ paths)
# - Related Skills references exist
```

---

## 2. Agents Validation

Validates agents in installed plugins:

```bash
# Checks performed:
# - Frontmatter fields (name, description, model, tools, skills)
# - Model validation (opus, sonnet, haiku only)
# - Skills references exist in src/skills/
# - Tools are valid CC tools
```

---

## 3. Hook Health

Verifies hooks are properly configured:

```bash
# Checks performed:
# - hooks.json schema valid
# - Bundle files exist (12 .mjs bundles)
# - Async hooks use fire-and-forget pattern (9 async)
# - Background hook metrics health (Issue #243)
# - Windows-safe spawning (PR #645)
```

---

## 4. Memory System

Validates graph memory with file-level integrity checks:

```bash
# Automated checks:
# - Graph: .claude/memory/ exists, decisions.jsonl valid JSONL, queue depth

# Run these commands to gather memory health data:
wc -l .claude/memory/decisions.jsonl 2>/dev/null || echo "No decisions yet"
wc -l .claude/memory/graph-queue.jsonl 2>/dev/null || echo "No graph queue"
ls -la .claude/memory/ 2>/dev/null || echo "Memory directory missing"
```

Read `.claude/memory/decisions.jsonl` directly to validate JSONL integrity (each line must parse as valid JSON). Count total lines, corrupt lines, and report per-category breakdown.

See [Memory Health](../references/memory-health.md) for details.

---

## 5. Build System

Verifies plugins/ sync with src/:

```bash
# Checks performed:
# - plugins/ generated from src/
# - Manifest counts match actual files
# - No orphaned skills/agents
```

---

## 6. Permission Rules

Leverages CC 2.1.3's unreachable permission rules detection.

---

## 7. Schema Compliance

Validates JSON files against schemas.

---

## 8. Coordination System

Checks multi-worktree coordination health (active instances, stale locks).

---

## 9. Context Budget

Monitors token usage against budget.

---

## 10. Claude Code Version

Validates runtime version against the [Version Compatibility Matrix](../references/version-compatibility.md).

---

## 11. External Dependencies

Checks optional tool availability:

```bash
# agent-browser (vercel-labs/agent-browser)
# Prefer the structured `agent-browser doctor --json` from 0.26.0+ (CC 2.1.121+).
# Falls back to the fuzzy "is the binary on PATH + symlink present?" probe on older versions.
if command -v agent-browser >/dev/null 2>&1; then
  if agent-browser doctor --json >/tmp/ab-doctor.json 2>/dev/null; then
    # Structured snapshot: surface only high-severity issues + a one-line health summary.
    jq -r '
      "agent-browser: " +
      (if (.daemon.status // "unknown") == "running" then "OK" else "DEGRADED" end) +
      " (chrome=" + (.chrome.version // "?") +
      ", net=" + (if .network.reachable then "✓" else "✗" end) + ")"
    ' /tmp/ab-doctor.json
    # Promote any high-severity issue into doctor's findings stream.
    jq -r '.issues[]? | select(.severity == "high") | "  ↳ HIGH: " + .message' /tmp/ab-doctor.json
  else
    # Fallback for agent-browser < 0.26 (no `doctor` subcommand)
    test -L "$HOME/.claude/skills/agent-browser" \
      && echo "agent-browser: installed (legacy probe — upgrade to 0.26+ for structured doctor)" \
      || echo "agent-browser: SYMLINK MISSING at ~/.claude/skills/agent-browser"
  fi
else
  echo "agent-browser: NOT INSTALLED (optional — install via vercel-labs/agent-browser ≥ 0.26)"
fi

# portless: stable named localhost URLs for local dev
#   which portless 2>/dev/null && portless list 2>/dev/null
#   If missing: RECOMMEND "npm i -g portless" for stable local dev URLs
#   If installed but not running: WARN "portless is installed but no services registered"
```

**Why structured doctor**: agent-browser 0.26.0 added `doctor --json` returning a snapshot of `chrome`, `daemon`, `network`, `config`, `security`, and `providers`. Wiring it in turns the previous "agent-browser broken" failure into actionable per-subsystem findings (Chrome version, daemon status, network reachability, high-severity issues), unblocking debug sessions where the user can't tell us what's wrong.

---

## 13. Plugin Validate (CC >= 2.1.77)

Runs `claude plugin validate` for official CC validation of frontmatter and hooks.json. This complements OrchestKit's custom checks (categories 1-3) with CC's built-in validator.

```bash
# Check CC version supports plugin validate (>= 2.1.77)
# If CC < 2.1.77, skip with: "Plugin validate: SKIPPED (requires CC >= 2.1.77)"

# Run official validation from plugin root
claude plugin validate

# Checks performed by CC:
# - SKILL.md frontmatter schema (required fields, types, allowed values)
# - hooks.json schema (event types, matchers, command paths)
# - Agent frontmatter schema (model, tools, skills fields)
# - File path resolution (command paths in hooks exist)
```

**Relationship to OrchestKit checks:** `claude plugin validate` performs structural/schema validation at the CC level. OrchestKit's categories 1-3 perform deeper semantic checks (token budgets, cross-references, async patterns) that CC does not cover. Both should pass for a fully healthy plugin.

---

## 14. Stale Project State (CC >= 2.1.126, #1582, fixed in #1587)

CC 2.1.126 added `claude project purge [path]` — deletes all CC state (transcripts, tasks, file history, config entry) for a project. Surface this as an info-severity diagnostic when canonical project paths no longer exist on disk.

```bash
# Check CC version supports project purge (>= 2.1.126)
# If CC < 2.1.126, skip silently (suggestion would be unactionable)

# Detect stale project state via the authoritative source.
# Use `claude project purge --dry-run --all` because the directory-name encoding
# under ~/.claude/projects/ is lossy (both `/` and `.` collapse to `-`, so the
# original path cannot be reconstructed deterministically — `my-project` is
# indistinguishable from `my.project` or `my/project`). The CLI's dry-run
# output emits canonical paths from ~/.claude.json which IS lossless.
#
#   claude project purge --dry-run --all 2>/dev/null \
#     | grep -oE 'projects\["[^"]+"\]' \
#     | sed -E 's/^projects\["//; s/"\]$//' \
#     | while IFS= read -r p; do
#         [ -n "$p" ] && [ ! -d "$p" ] && echo "$p"
#       done
#
# Example output (info severity, never blocking):
# ℹ Stale project state: 3 canonical paths reference directories that no longer exist on disk.
#    Suggested cleanup (always preview first):
#      claude project purge --dry-run --all
#      claude project purge --interactive    # confirm each project
```

**Why info, never warn or fail:** the user may have moved a project rather than deleted it; aggressive removal would lose transcript history. Always recommend `--dry-run` first. Mirrors the pattern from `claude plugin prune` (Category 13b).

**Why not parse `~/.claude/projects/` directly:** the directory naming is a lossy collapse of the original path (`/` and `.` both become `-`). A naive `sed 's|-|/|g'` decode produces ambiguous results — `~/.claude/projects/Users-me-my-project` could be `/Users/me/my-project`, `/Users/me/my/project`, `/Users/me/my.project`, or other combinations. The dry-run output above is the canonical source.
