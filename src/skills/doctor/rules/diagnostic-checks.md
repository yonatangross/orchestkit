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
# Checks performed:
# - agent-browser: installed globally via skills CLI
# - Validates symlink exists at ~/.claude/skills/agent-browser
```

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
