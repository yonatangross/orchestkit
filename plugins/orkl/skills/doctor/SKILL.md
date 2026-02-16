---
name: doctor
license: MIT
compatibility: "Claude Code 2.1.34+."
description: "OrchestKit doctor for health diagnostics. Use when running checks on plugin health, diagnosing problems, or troubleshooting issues."
argument-hint: "[--verbose]"
context: inherit
version: 3.0.0
author: OrchestKit
tags: [health-check, diagnostics, validation, permissions, hooks, skills, agents, memory]
user-invocable: true
allowed-tools: [Bash, Read, Grep, Glob]
skills: [configure]
complexity: low
metadata:
  category: document-asset-creation
---

# OrchestKit Health Diagnostics

## Overview

The `/ork:doctor` command performs comprehensive health checks on your OrchestKit installation. It auto-detects installed plugins and validates 10 categories:

1. **Installed Plugins** - Detects orkl or ork
2. **Skills Validation** - Frontmatter, references, token budget (dynamic count)
3. **Agents Validation** - Frontmatter, tool refs, skill refs (dynamic count)
4. **Hook Health** - Registration, bundles, async patterns
5. **Permission Rules** - Detects unreachable rules (CC 2.1.3 feature)
6. **Schema Compliance** - Validates JSON files against schemas
7. **Coordination System** - Checks lock health and registry integrity
8. **Context Budget** - Monitors token usage against budget
9. **Memory System** - Graph memory health
10. **Claude Code Version** - Validates CC >= 2.1.34

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

### 0. Installed Plugins Detection

Auto-detects which OrchestKit plugins are installed:

```bash
# Detection logic:
# - Scans for .claude-plugin/plugin.json in plugin paths
# - Identifies orkl or ork
# - Counts skills/agents per installed plugin
```

**Output (orkl):**
```
Installed Plugins: 1
- orkl: 45 skills, 36 agents, 89 hook entries
```

**Output (ork full):**
```
Installed Plugins: 1
- ork: 62 skills, 36 agents, 89 hook entries
```

### 1. Skills Validation

Validates skills in installed plugins (count varies by installation):

```bash
# Checks performed:
# - SKILL.md frontmatter (name, description, user-invocable)
# - context: fork field (required for CC 2.1.0+)
# - Token budget compliance (300-5000 tokens)
# - Internal link validation (references/ paths)
# - Related Skills references exist
```

**Output (full ork):**
```
Skills: 62/62 valid
- User-invocable: 24 commands
- Reference skills: 38
```

**Output (orkl only):**
```
Skills: 45/45 valid
- User-invocable: 24 commands
- Reference skills: 21
```

### 2. Agents Validation

Validates agents in installed plugins:

```bash
# Checks performed:
# - Frontmatter fields (name, description, model, tools, skills)
# - Model validation (opus, sonnet, haiku only)
# - Skills references exist in src/skills/
# - Tools are valid CC tools
```

**Output:**
```
Agents: 36/36 valid
- Models: 12 sonnet, 15 haiku, 8 opus
- All skill references valid
```

### 3. Hook Health

Verifies hooks are properly configured:

```bash
# Checks performed:
# - hooks.json schema valid
# - Bundle files exist (12 .mjs bundles)
# - Async hooks use fire-and-forget pattern (7 async)
# - Background hook metrics health (Issue #243)
```

**Output:**
```
Hooks: 66/66 entries valid (12 bundles)
- PreToolUse: 14, PostToolUse: 6, SubagentStart: 7, SubagentStop: 7
- Setup: 6, SessionStart: 5, UserPromptSubmit: 5, PermissionRequest: 3
- Async hooks: 7 (fire-and-forget)
- Error Rate: 0.3%
```

See [Hook Validation](references/hook-validation.md) for details.

### 4. Memory System (NEW)

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

**Output:**
```
Memory System: healthy
- Graph Memory: 42 decisions, 0 corrupt, queue depth 3
```

See [Memory Health](references/memory-health.md) for details.

### 5. Build System (NEW)

Verifies plugins/ sync with src/:

```bash
# Checks performed:
# - plugins/ generated from src/
# - Manifest counts match actual files
# - No orphaned skills/agents
```

**Output:**
```
Build System: in sync
- Skills: 62 src/ = 62 plugins/
- Agents: 36 src/ = 36 plugins/
- Last build: 2 minutes ago
```

### 6. Permission Rules

Leverages CC 2.1.3's unreachable permission rules detection:

**Output:**
```
Permission Rules: 12/12 reachable
```

### 7. Schema Compliance

Validates JSON files against schemas:

**Output:**
```
Schemas: 15/15 compliant
```

### 8. Coordination System

Checks multi-worktree coordination health:

**Output:**
```
Coordination: healthy
- Active instances: 1
- Stale locks: 0
```

### 9. Context Budget

Monitors token usage:

**Output:**
```
Context Budget: 1850/2200 tokens (84%)
```

### 10. Claude Code Version

Validates runtime version:

**Output:**
```
Claude Code: 2.1.42 (OK)
- Minimum required: 2.1.34
```

## Report Format

**Full ork plugin:**
```
+===================================================================+
|                    OrchestKit Health Report                        |
+===================================================================+
| Version: 6.0.13  |  CC: 2.1.42  |  Plugins: ork              |
+===================================================================+
| Skills           | 62/62 valid                                    |
| Agents           | 36/36 valid                                    |
| Hooks            | 66/66 entries (12 bundles)                     |
| Memory           | Graph memory healthy                           |
| Permissions      | 12/12 reachable                                |
| Schemas          | 15/15 compliant                                |
| Context          | 1850/2200 tokens (84%)                         |
| Coordination     | 0 stale locks                                  |
| CC Version       | 2.1.42 (OK)                                    |
+===================================================================+
| Status: HEALTHY (9/9 checks passed)                               |
+===================================================================+
```

**Domain-specific plugins (e.g., orkl + orkl):**
```
+===================================================================+
|                    OrchestKit Health Report                        |
+===================================================================+
| Version: 6.0.13  |  CC: 2.1.42  |  Plugins: 3 installed           |
+===================================================================+
| Installed        | ork, orkl, orkl       |
| Skills           | 38/38 valid (combined)                         |
| Agents           | 2/2 valid                                      |
| Hooks            | 66/66 entries (via ork)                    |
| Memory           | Graph memory healthy                           |
+===================================================================+
```

## JSON Output (CI Integration)

```bash
/ork:doctor --json
```

```json
{
  "version": "6.0.13",
  "claudeCode": "2.1.42",
  "status": "healthy",
  "plugins": {
    "installed": ["orkl", "ork-creative", "ork"],
    "count": 3
  },
  "checks": {
    "skills": {"passed": true, "count": 62, "perPlugin": {"ork": 62}},
    "agents": {"passed": true, "count": 36, "perPlugin": {"ork": 36}},
    "hooks": {"passed": true, "entries": 66, "bundles": 12, "source": "ork"},
    "memory": {"passed": true, "available": ["graph"]},
    "permissions": {"passed": true, "count": 12},
    "schemas": {"passed": true, "count": 15},
    "context": {"passed": true, "usage": 0.84},
    "coordination": {"passed": true, "staleLocks": 0},
    "ccVersion": {"passed": true, "version": "2.1.42"}
  },
  "exitCode": 0
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks pass |
| 1 | One or more checks failed |

## Interpreting Results

| Status | Meaning | Action |
|--------|---------|--------|
| All checks pass | Plugin healthy | None required |
| Skills warning | Invalid frontmatter | Run `npm run test:skills` |
| Agents warning | Invalid frontmatter | Run `npm run test:agents` |
| Hook error | Missing/broken hook | Check hooks.json and bundles |
| Memory warning | Graph unavailable | Check .claude/memory/ directory |
| Build warning | Out of sync | Run `npm run build` |
| Permission warning | Unreachable rules | Review `.claude/settings.json` |

## Troubleshooting

### "Skills validation failed"

```bash
# Run skill structure tests
npm run test:skills
./tests/skills/structure/test-skill-md.sh
```

### "Build out of sync"

```bash
# Rebuild plugins from source
npm run build
```

### "Memory unavailable"

```bash
# Check graph memory
ls -la .claude/memory/
```

## Related Skills

- `configure` - Configure plugin settings
- `quality-gates` - CI/CD integration
- `security-scanning` - Comprehensive audits

## References

- [Skills Validation](references/skills-validation.md)
- [Agents Validation](references/agents-validation.md)
- [Hook Validation](references/hook-validation.md)
- [Memory Health](references/memory-health.md)
- [Permission Rules](references/permission-rules.md)
- [Schema Validation](references/schema-validation.md)
