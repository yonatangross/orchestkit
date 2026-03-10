---
name: doctor
license: MIT
compatibility: "Claude Code 2.1.72+."
description: "OrchestKit doctor for health diagnostics. Use when running checks on plugin health, diagnosing problems, or troubleshooting issues."
argument-hint: "[--verbose]"
context: inherit
version: 3.1.0
author: OrchestKit
tags: [health-check, diagnostics, validation, permissions, hooks, skills, agents, memory]
user-invocable: true
disable-model-invocation: true
allowed-tools: [Bash, Read, Grep, Glob]
skills: [configure]
complexity: low
model: haiku
hooks:
  PreToolUse:
    - matcher: "Bash"
      command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/doctor-env-snapshot"
      once: true
metadata:
  category: document-asset-creation
---

# OrchestKit Health Diagnostics

## Argument Resolution

```python
FLAGS = "$ARGUMENTS"         # Full argument string, e.g., "--verbose" or "--json"
FLAG = "$ARGUMENTS[0]"       # First token: -v, --verbose, --json, --category=X
# $ARGUMENTS[0], $ARGUMENTS[1] for indexed access (CC 2.1.59)
```

## Overview

The `/ork:doctor` command performs comprehensive health checks on your OrchestKit installation. It auto-detects installed plugins and validates 12 categories:

1. **Installed Plugins** - Detects ork plugin
2. **Skills Validation** - Frontmatter, references, token budget (dynamic count)
3. **Agents Validation** - Frontmatter, tool refs, skill refs (dynamic count)
4. **Hook Health** - Registration, bundles, async patterns
5. **Permission Rules** - Detects unreachable rules (CC 2.1.3 feature)
6. **Schema Compliance** - Validates JSON files against schemas
7. **Coordination System** - Checks lock health and registry integrity
8. **Context Budget** - Monitors token usage against budget
9. **Memory System** - Graph memory health
10. **Claude Code Version & Channel** - Validates CC >= 2.1.47, detects release channel (stable/beta/alpha)
11. **External Dependencies** - Checks optional tool availability (agent-browser)
12. **MCP Status** - Active vs disabled vs misconfigured, API key presence for paid MCPs

## When to Use

- After installing or updating OrchestKit
- When hooks aren't firing as expected
- Before deploying to a team environment
- When debugging coordination issues
- After running `npm run build`

> **Tip (CC 2.1.69+):** After fixing issues found by doctor, run `/reload-plugins` to activate plugin changes without restarting your session.

## Quick Start

```bash
/ork:doctor           # Standard health check
/ork:doctor -v        # Verbose output
/ork:doctor --json    # Machine-readable for CI
```

## CLI Options

| Flag | Description |
|------|-------------|
| `-v`, `--verbose` | Detailed output per check |
| `--json` | JSON output for CI integration |
| `--category=X` | Run only specific category |

## Health Check Categories

> **Detailed check procedures**: Load `Read("${CLAUDE_SKILL_DIR}/rules/diagnostic-checks.md")` for bash commands and validation logic per category.
>
> **MCP-specific checks**: Load `Read("${CLAUDE_SKILL_DIR}/rules/mcp-status-checks.md")` for credential validation and misconfiguration detection.
>
> **Output examples**: Load `Read("${CLAUDE_SKILL_DIR}/references/health-check-outputs.md")` for sample output per category.

### Categories 0-3: Core Validation

| Category | What It Checks | Reference |
|----------|---------------|-----------|
| **0. Installed Plugins** | Auto-detects ork plugin, counts skills/agents | load `${CLAUDE_SKILL_DIR}/rules/diagnostic-checks.md` |
| **1. Skills** | Frontmatter, context field, token budget, links | load `${CLAUDE_SKILL_DIR}/references/skills-validation.md` |
| **2. Agents** | Frontmatter, model, skill refs, tool refs | load `${CLAUDE_SKILL_DIR}/references/agents-validation.md` |
| **3. Hooks** | hooks.json schema, bundles, async patterns | load `${CLAUDE_SKILL_DIR}/references/hook-validation.md` |

### Categories 4-5: System Health

| Category | What It Checks | Reference |
|----------|---------------|-----------|
| **4. Memory** | .claude/memory/ exists, decisions.jsonl integrity, queue depth | load `${CLAUDE_SKILL_DIR}/references/memory-health.md` |
| **5. Build** | plugins/ sync with src/, manifest counts, orphans | load `${CLAUDE_SKILL_DIR}/rules/diagnostic-checks.md` |

### Categories 6-9: Infrastructure

| Category | What It Checks |
|----------|---------------|
| **6. Permission Rules** | Unreachable rules detection (CC 2.1.3) |
| **7. Schema Compliance** | JSON files against schemas |
| **8. Coordination** | Multi-worktree lock health, stale locks |
| **9. Context Budget** | Token usage against budget |

### Categories 10-12: Environment

| Category | What It Checks | Reference |
|----------|---------------|-----------|
| **10. CC Version & Channel** | Runtime version against minimum required, release channel (stable/beta/alpha) | load `${CLAUDE_SKILL_DIR}/references/version-compatibility.md` |
| **11. External Deps** | Optional tools (agent-browser) | load `${CLAUDE_SKILL_DIR}/rules/diagnostic-checks.md` |
| **12. MCP Status** | Enabled/disabled state, credential checks | load `${CLAUDE_SKILL_DIR}/rules/mcp-status-checks.md` |

## Report Format

> Load `Read("${CLAUDE_SKILL_DIR}/references/report-format.md")` for ASCII report templates, JSON CI output schema, and exit codes.

## Interpreting Results & Troubleshooting

> Load `Read("${CLAUDE_SKILL_DIR}/references/remediation-guide.md")` for the full results interpretation table and troubleshooting steps for common failures (skills validation, build sync, memory).

## Related Skills

- `ork:configure` - Configure plugin settings
- `ork:quality-gates` - CI/CD integration
- `security-scanning` - Comprehensive audits

## References

Load on demand with `Read("${CLAUDE_SKILL_DIR}/references/<file>")` or `Read("${CLAUDE_SKILL_DIR}/rules/<file>")`:
| File | Content |
|------|---------|
| `rules/diagnostic-checks.md` | Bash commands and validation logic per category |
| `rules/mcp-status-checks.md` | Credential validation and misconfiguration detection |
| `references/remediation-guide.md` | Results interpretation and troubleshooting steps |
| `references/health-check-outputs.md` | Sample output per category |
| `references/skills-validation.md` | Skills frontmatter and structure checks |
| `references/agents-validation.md` | Agents frontmatter and tool ref checks |
| `references/hook-validation.md` | Hook registration and bundle checks |
| `references/memory-health.md` | Memory system integrity checks |
| `references/permission-rules.md` | Permission rule detection |
| `references/schema-validation.md` | JSON schema compliance |
| `references/report-format.md` | ASCII report templates and JSON CI output |
| `references/version-compatibility.md` | CC version and channel validation |
