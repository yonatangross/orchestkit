---
name: doctor
license: MIT
compatibility: "Claude Code 2.1.59+."
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
discovers: [configure, setup]
metadata:
  category: document-asset-creation
---

# OrchestKit Health Diagnostics

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

> **Detailed check procedures**: See [rules/diagnostic-checks.md](rules/diagnostic-checks.md) for bash commands and validation logic per category.
>
> **MCP-specific checks**: See [rules/mcp-status-checks.md](rules/mcp-status-checks.md) for credential validation and misconfiguration detection.
>
> **Output examples**: See [references/health-check-outputs.md](references/health-check-outputs.md) for sample output per category.

### Categories 0-3: Core Validation

| Category | What It Checks | Reference |
|----------|---------------|-----------|
| **0. Installed Plugins** | Auto-detects ork plugin, counts skills/agents | [diagnostic-checks](rules/diagnostic-checks.md) |
| **1. Skills** | Frontmatter, context field, token budget, links | [skills-validation](references/skills-validation.md) |
| **2. Agents** | Frontmatter, model, skill refs, tool refs | [agents-validation](references/agents-validation.md) |
| **3. Hooks** | hooks.json schema, bundles, async patterns | [hook-validation](references/hook-validation.md) |

### Categories 4-5: System Health

| Category | What It Checks | Reference |
|----------|---------------|-----------|
| **4. Memory** | .claude/memory/ exists, decisions.jsonl integrity, queue depth | [memory-health](references/memory-health.md) |
| **5. Build** | plugins/ sync with src/, manifest counts, orphans | [diagnostic-checks](rules/diagnostic-checks.md) |

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
| **10. CC Version & Channel** | Runtime version against minimum required, release channel (stable/beta/alpha) | [version-compatibility](references/version-compatibility.md) |
| **11. External Deps** | Optional tools (agent-browser) | [diagnostic-checks](rules/diagnostic-checks.md) |
| **12. MCP Status** | Enabled/disabled state, credential checks | [mcp-status-checks](rules/mcp-status-checks.md) |

## Report Format

> See [references/report-format.md](references/report-format.md) for ASCII report templates, JSON CI output schema, and exit codes.

## Interpreting Results & Troubleshooting

> See [references/remediation-guide.md](references/remediation-guide.md) for the full results interpretation table and troubleshooting steps for common failures (skills validation, build sync, memory).

## Related Skills

- `ork:configure` - Configure plugin settings
- `ork:quality-gates` - CI/CD integration
- `security-scanning` - Comprehensive audits

## References

- [Diagnostic Checks](rules/diagnostic-checks.md)
- [MCP Status Checks](rules/mcp-status-checks.md)
- [Remediation Guide](references/remediation-guide.md)
- [Health Check Outputs](references/health-check-outputs.md)
- [Skills Validation](references/skills-validation.md)
- [Agents Validation](references/agents-validation.md)
- [Hook Validation](references/hook-validation.md)
- [Memory Health](references/memory-health.md)
- [Permission Rules](references/permission-rules.md)
- [Schema Validation](references/schema-validation.md)
- [Report Format](references/report-format.md)
- [Version Compatibility](references/version-compatibility.md)
